
-- Extend purchase_bills with supplier + invoice metadata
ALTER TABLE public.purchase_bills
  ADD COLUMN IF NOT EXISTS supplier_gst text,
  ADD COLUMN IF NOT EXISTS supplier_address text,
  ADD COLUMN IF NOT EXISTS supplier_contact text,
  ADD COLUMN IF NOT EXISTS round_off numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_payable numeric,
  ADD COLUMN IF NOT EXISTS invoice_file_url text,
  ADD COLUMN IF NOT EXISTS extracted_payload jsonb,
  ADD COLUMN IF NOT EXISTS imported_by uuid;

-- Line items linking purchase bill rows to medicines
CREATE TABLE IF NOT EXISTS public.purchase_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  purchase_bill_id uuid NOT NULL REFERENCES public.purchase_bills(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE SET NULL,
  medicine_name text NOT NULL,
  brand_name text,
  generic_name text,
  strength text,
  manufacturer text,
  pack_size text,
  batch_no text,
  mfg_date date,
  expiry_date date,
  quantity integer NOT NULL DEFAULT 0,
  free_quantity integer NOT NULL DEFAULT 0,
  purchase_rate numeric NOT NULL DEFAULT 0,
  mrp numeric NOT NULL DEFAULT 0,
  selling_rate numeric,
  gst_percent numeric NOT NULL DEFAULT 12,
  hsn_code text,
  amount numeric NOT NULL DEFAULT 0,
  ai_confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_bill_items TO authenticated;
GRANT ALL ON public.purchase_bill_items TO service_role;
ALTER TABLE public.purchase_bill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access to purchase bill items"
  ON public.purchase_bill_items
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE INDEX IF NOT EXISTS purchase_bill_items_bill_idx ON public.purchase_bill_items(purchase_bill_id);
CREATE INDEX IF NOT EXISTS purchase_bill_items_med_idx ON public.purchase_bill_items(medicine_id);
CREATE INDEX IF NOT EXISTS medicines_name_lower_idx ON public.medicines(hospital_id, lower(name));

-- Atomic import: upsert medicines, create bill + items, top up stock
CREATE OR REPLACE FUNCTION public.import_purchase_invoice(_supplier jsonb, _invoice jsonb, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _hospital_id uuid;
  _user_id uuid := auth.uid();
  _bill_id uuid;
  _item jsonb;
  _med_id uuid;
  _qty integer;
  _free integer;
  _name text;
  _strength text;
  _created int := 0;
  _updated int := 0;
BEGIN
  _hospital_id := public.get_user_hospital_id(_user_id);
  IF _hospital_id IS NULL THEN
    RAISE EXCEPTION 'No hospital access for current user';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one medicine line item is required';
  END IF;

  INSERT INTO public.purchase_bills (
    hospital_id, bill_type, vendor, invoice_no, bill_date,
    subtotal, gst_amount, discount, total_amount,
    payment_mode, payment_status, notes,
    supplier_gst, supplier_address, supplier_contact,
    round_off, net_payable, invoice_file_url, extracted_payload, imported_by
  ) VALUES (
    _hospital_id,
    'Pharmacy',
    COALESCE(NULLIF(_supplier->>'name',''), 'Unknown Supplier'),
    COALESCE(NULLIF(_invoice->>'invoiceNo',''), 'INV-' || to_char(now(),'YYYYMMDDHH24MISS')),
    COALESCE(NULLIF(_invoice->>'invoiceDate','')::date, CURRENT_DATE),
    COALESCE((_invoice->>'subtotal')::numeric, (_invoice->>'totalAmount')::numeric, 0),
    COALESCE((_invoice->>'gstAmount')::numeric, 0),
    COALESCE((_invoice->>'discount')::numeric, 0),
    COALESCE((_invoice->>'totalAmount')::numeric, 0),
    'Pending', 'Pending',
    'Imported via AI scanner',
    NULLIF(_supplier->>'gst',''),
    NULLIF(_supplier->>'address',''),
    NULLIF(_supplier->>'contact',''),
    COALESCE((_invoice->>'roundOff')::numeric, 0),
    COALESCE((_invoice->>'netPayable')::numeric, (_invoice->>'totalAmount')::numeric, 0),
    NULLIF(_invoice->>'fileUrl',''),
    jsonb_build_object('supplier', _supplier, 'invoice', _invoice, 'items', _items),
    _user_id
  ) RETURNING id INTO _bill_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _name := NULLIF(trim(_item->>'name'),'');
    IF _name IS NULL THEN CONTINUE; END IF;
    _strength := NULLIF(_item->>'strength','');
    _qty := COALESCE((_item->>'quantity')::integer, 0);
    _free := COALESCE((_item->>'freeQuantity')::integer, 0);

    -- match existing medicine by barcode or name+strength
    SELECT id INTO _med_id FROM public.medicines
      WHERE hospital_id = _hospital_id
        AND (
          (NULLIF(_item->>'barcode','') IS NOT NULL AND barcode = _item->>'barcode')
          OR (lower(name) = lower(_name) AND COALESCE(lower(strength),'') = COALESCE(lower(_strength),''))
        )
      LIMIT 1;

    IF _med_id IS NULL THEN
      INSERT INTO public.medicines (
        hospital_id, name, brand_name, generic_name, salt_name, strength, dosage_form,
        manufacturer, batch_no, expiry_date, mrp, selling_price, hsn_code, gst_percent,
        barcode, unit, stock, min_stock, is_active, category
      ) VALUES (
        _hospital_id, _name,
        NULLIF(_item->>'brandName',''),
        NULLIF(_item->>'genericName',''),
        NULLIF(_item->>'genericName',''),
        _strength,
        NULLIF(_item->>'dosageForm',''),
        NULLIF(_item->>'manufacturer',''),
        NULLIF(_item->>'batchNo',''),
        NULLIF(_item->>'expiryDate','')::date,
        COALESCE((_item->>'mrp')::numeric, 0),
        COALESCE((_item->>'sellingRate')::numeric, (_item->>'mrp')::numeric, 0),
        NULLIF(_item->>'hsnCode',''),
        COALESCE((_item->>'gstPercent')::numeric, 12),
        NULLIF(_item->>'barcode',''),
        COALESCE(NULLIF(_item->>'packSize',''), 'Strip'),
        GREATEST(0, _qty + _free),
        0, true, 'Medicine'
      ) RETURNING id INTO _med_id;
      _created := _created + 1;
    ELSE
      UPDATE public.medicines SET
        brand_name      = COALESCE(NULLIF(_item->>'brandName',''), brand_name),
        generic_name    = COALESCE(NULLIF(_item->>'genericName',''), generic_name),
        manufacturer    = COALESCE(NULLIF(_item->>'manufacturer',''), manufacturer),
        batch_no        = COALESCE(NULLIF(_item->>'batchNo',''), batch_no),
        expiry_date     = COALESCE(NULLIF(_item->>'expiryDate','')::date, expiry_date),
        mrp             = COALESCE(NULLIF(_item->>'mrp','')::numeric, mrp),
        selling_price   = COALESCE(NULLIF(_item->>'sellingRate','')::numeric, NULLIF(_item->>'mrp','')::numeric, selling_price),
        hsn_code        = COALESCE(NULLIF(_item->>'hsnCode',''), hsn_code),
        gst_percent     = COALESCE(NULLIF(_item->>'gstPercent','')::numeric, gst_percent),
        barcode         = COALESCE(NULLIF(_item->>'barcode',''), barcode),
        stock           = COALESCE(stock,0) + GREATEST(0, _qty + _free),
        updated_at      = now()
      WHERE id = _med_id;
      _updated := _updated + 1;
    END IF;

    INSERT INTO public.purchase_bill_items (
      hospital_id, purchase_bill_id, medicine_id, medicine_name,
      brand_name, generic_name, strength, manufacturer, pack_size,
      batch_no, mfg_date, expiry_date,
      quantity, free_quantity, purchase_rate, mrp, selling_rate,
      gst_percent, hsn_code, amount, ai_confidence
    ) VALUES (
      _hospital_id, _bill_id, _med_id, _name,
      NULLIF(_item->>'brandName',''),
      NULLIF(_item->>'genericName',''),
      _strength,
      NULLIF(_item->>'manufacturer',''),
      NULLIF(_item->>'packSize',''),
      NULLIF(_item->>'batchNo',''),
      NULLIF(_item->>'mfgDate','')::date,
      NULLIF(_item->>'expiryDate','')::date,
      _qty, _free,
      COALESCE((_item->>'purchaseRate')::numeric, 0),
      COALESCE((_item->>'mrp')::numeric, 0),
      NULLIF(_item->>'sellingRate','')::numeric,
      COALESCE((_item->>'gstPercent')::numeric, 12),
      NULLIF(_item->>'hsnCode',''),
      COALESCE((_item->>'amount')::numeric, COALESCE((_item->>'purchaseRate')::numeric,0) * _qty),
      NULLIF(_item->>'confidence','')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object(
    'bill_id', _bill_id,
    'created', _created,
    'updated', _updated,
    'total_items', _created + _updated
  );
END;
$fn$;
