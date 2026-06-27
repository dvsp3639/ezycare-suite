
ALTER TABLE public.purchase_bills
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_by_name text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS device_info text,
  ADD COLUMN IF NOT EXISTS source_files jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_corrections jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

-- Extend import RPC to accept and persist audit trail data
CREATE OR REPLACE FUNCTION public.import_purchase_invoice(_supplier jsonb, _invoice jsonb, _items jsonb, _audit jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _dup_count int := 0;
BEGIN
  _hospital_id := public.get_user_hospital_id(_user_id);
  IF _hospital_id IS NULL THEN
    RAISE EXCEPTION 'No hospital access for current user';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one medicine line item is required';
  END IF;

  -- Duplicate invoice guard (same supplier+invoice_no for this hospital)
  IF NULLIF(_invoice->>'invoiceNo','') IS NOT NULL AND NULLIF(_supplier->>'name','') IS NOT NULL THEN
    SELECT count(*) INTO _dup_count FROM public.purchase_bills
      WHERE hospital_id = _hospital_id
        AND invoice_no = _invoice->>'invoiceNo'
        AND lower(vendor) = lower(_supplier->>'name');
    IF _dup_count > 0 AND COALESCE((_audit->>'force')::boolean, false) = false THEN
      RAISE EXCEPTION 'duplicate_invoice: Invoice % from % already imported', _invoice->>'invoiceNo', _supplier->>'name';
    END IF;
  END IF;

  INSERT INTO public.purchase_bills (
    hospital_id, bill_type, vendor, invoice_no, bill_date,
    subtotal, gst_amount, discount, total_amount,
    payment_mode, payment_status, notes,
    supplier_gst, supplier_address, supplier_contact,
    round_off, net_payable, invoice_file_url, extracted_payload, imported_by,
    verified_by, verified_by_name, approved_by, approved_by_name,
    employee_id, device_info, source_files, manual_corrections, warnings, imported_at
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
    COALESCE(NULLIF(_audit->>'notes',''), 'Imported via AI scanner'),
    NULLIF(_supplier->>'gst',''),
    NULLIF(_supplier->>'address',''),
    NULLIF(_supplier->>'contact',''),
    COALESCE((_invoice->>'roundOff')::numeric, 0),
    COALESCE((_invoice->>'netPayable')::numeric, (_invoice->>'totalAmount')::numeric, 0),
    NULLIF(_invoice->>'fileUrl',''),
    jsonb_build_object('supplier', _supplier, 'invoice', _invoice, 'items', _items),
    _user_id,
    COALESCE(NULLIF(_audit->>'verified_by','')::uuid, _user_id),
    NULLIF(_audit->>'verified_by_name',''),
    NULLIF(_audit->>'approved_by','')::uuid,
    NULLIF(_audit->>'approved_by_name',''),
    NULLIF(_audit->>'employee_id',''),
    NULLIF(_audit->>'device_info',''),
    COALESCE(_audit->'source_files', '[]'::jsonb),
    COALESCE(_audit->'manual_corrections', '[]'::jsonb),
    COALESCE(_audit->'warnings', '[]'::jsonb),
    now()
  ) RETURNING id INTO _bill_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _name := NULLIF(trim(_item->>'name'),'');
    IF _name IS NULL THEN CONTINUE; END IF;
    _strength := NULLIF(_item->>'strength','');
    _qty := COALESCE((_item->>'quantity')::integer, 0);
    _free := COALESCE((_item->>'freeQuantity')::integer, 0);

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
$function$;
