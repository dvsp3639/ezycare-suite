CREATE OR REPLACE FUNCTION public.create_pharmacy_sale(_order jsonb, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _hospital_id uuid;
  _order_id uuid;
  _item jsonb;
  _medicine_id uuid;
  _quantity integer;
  _is_return boolean;
  _current_stock integer;
  _inserted public.pharmacy_orders%ROWTYPE;
BEGIN
  _hospital_id := public.get_user_hospital_id(auth.uid());

  IF _hospital_id IS NULL THEN
    RAISE EXCEPTION 'No hospital access found for this user';
  END IF;

  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one medicine is required';
  END IF;

  _is_return := COALESCE((_order->>'issue_type') ILIKE '%Return%', false);

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _medicine_id := NULLIF(_item->>'medicine_id', '')::uuid;
    _quantity := COALESCE((_item->>'quantity')::integer, 0);

    IF _quantity <= 0 THEN
      RAISE EXCEPTION 'Medicine quantity must be greater than zero';
    END IF;

    IF _medicine_id IS NOT NULL AND NOT _is_return THEN
      SELECT stock INTO _current_stock
      FROM public.medicines
      WHERE id = _medicine_id AND hospital_id = _hospital_id
      FOR UPDATE;

      IF _current_stock IS NULL THEN
        RAISE EXCEPTION 'Medicine not found for this hospital';
      END IF;

      IF _current_stock < _quantity THEN
        RAISE EXCEPTION 'Insufficient stock for %', COALESCE(_item->>'medicine_name', 'selected medicine');
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.pharmacy_orders (
    hospital_id,
    issue_type,
    patient_name,
    registration_number,
    mobile,
    age,
    gender,
    doctor_name,
    issue_date,
    total_amount,
    discount,
    gst_amount,
    net_amount,
    payment_mode,
    status,
    sale_channel,
    customer_name,
    customer_mobile,
    completed_at
  ) VALUES (
    _hospital_id,
    COALESCE(NULLIF(_order->>'issue_type', ''), 'OP Sale'),
    COALESCE(NULLIF(_order->>'patient_name', ''), NULLIF(_order->>'customer_name', ''), 'Walk-in Customer'),
    COALESCE(_order->>'registration_number', ''),
    COALESCE(_order->>'mobile', _order->>'customer_mobile', ''),
    NULLIF(_order->>'age', '')::integer,
    COALESCE(_order->>'gender', ''),
    COALESCE(_order->>'doctor_name', ''),
    COALESCE(NULLIF(_order->>'issue_date', '')::date, CURRENT_DATE),
    COALESCE((_order->>'total_amount')::numeric, 0),
    COALESCE((_order->>'discount')::numeric, 0),
    COALESCE((_order->>'gst_amount')::numeric, 0),
    COALESCE((_order->>'net_amount')::numeric, 0),
    COALESCE(NULLIF(_order->>'payment_mode', ''), 'Cash'),
    'Completed',
    COALESCE(NULLIF(_order->>'sale_channel', ''), 'Patient'),
    COALESCE(NULLIF(_order->>'customer_name', ''), NULLIF(_order->>'patient_name', ''), 'Walk-in Customer'),
    COALESCE(_order->>'customer_mobile', _order->>'mobile', ''),
    now()
  ) RETURNING * INTO _inserted;

  _order_id := _inserted.id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _medicine_id := NULLIF(_item->>'medicine_id', '')::uuid;
    _quantity := COALESCE((_item->>'quantity')::integer, 0);

    INSERT INTO public.pharmacy_order_items (
      hospital_id,
      order_id,
      medicine_id,
      medicine_name,
      batch_no,
      quantity,
      mrp,
      discount,
      gst_percent,
      amount
    ) VALUES (
      _hospital_id,
      _order_id,
      _medicine_id,
      COALESCE(_item->>'medicine_name', ''),
      COALESCE(_item->>'batch_no', ''),
      _quantity,
      COALESCE((_item->>'mrp')::numeric, 0),
      COALESCE((_item->>'discount')::numeric, 0),
      COALESCE((_item->>'gst_percent')::numeric, 12),
      COALESCE((_item->>'amount')::numeric, 0)
    );

    IF _medicine_id IS NOT NULL THEN
      UPDATE public.medicines
      SET stock = stock + CASE WHEN _is_return THEN _quantity ELSE -_quantity END,
          updated_at = now()
      WHERE id = _medicine_id AND hospital_id = _hospital_id;
    END IF;
  END LOOP;

  RETURN to_jsonb(_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pharmacy_sale(jsonb, jsonb) TO authenticated;