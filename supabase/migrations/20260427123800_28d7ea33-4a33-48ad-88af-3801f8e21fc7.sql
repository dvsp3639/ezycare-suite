ALTER TABLE public.pharmacy_orders
ADD COLUMN IF NOT EXISTS sale_channel text NOT NULL DEFAULT 'Patient',
ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT 'Walk-in Customer',
ADD COLUMN IF NOT EXISTS customer_mobile text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS invoice_no text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_hospital_issue_date_status
ON public.pharmacy_orders (hospital_id, issue_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_hospital_issue_type
ON public.pharmacy_orders (hospital_id, issue_type);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_hospital_sale_channel
ON public.pharmacy_orders (hospital_id, sale_channel);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_completed_at
ON public.pharmacy_orders (completed_at DESC)
WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order_id
ON public.pharmacy_order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_medicine_id
ON public.pharmacy_order_items (medicine_id)
WHERE medicine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medicines_hospital_name
ON public.medicines (hospital_id, name);

CREATE OR REPLACE FUNCTION public.next_pharmacy_invoice_no(_hospital_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _counter integer;
BEGIN
  INSERT INTO public.registration_counters (hospital_id, counter)
  VALUES (_hospital_id, 1)
  ON CONFLICT (hospital_id)
  DO UPDATE SET counter = registration_counters.counter + 1
  RETURNING counter INTO _counter;

  RETURN 'PHR-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(_counter::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_pharmacy_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.hospital_id IS NULL THEN
    NEW.hospital_id := public.get_user_hospital_id(auth.uid());
  END IF;

  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := public.next_pharmacy_invoice_no(NEW.hospital_id);
  END IF;

  IF NEW.sale_channel IS NULL OR NEW.sale_channel = '' THEN
    NEW.sale_channel := CASE
      WHEN NEW.registration_number IS NULL OR NEW.registration_number = '' THEN 'Direct'
      ELSE 'Patient'
    END;
  END IF;

  IF NEW.sale_channel = 'Direct' THEN
    NEW.patient_name := COALESCE(NULLIF(NEW.patient_name, ''), NULLIF(NEW.customer_name, ''), 'Walk-in Customer');
    NEW.registration_number := COALESCE(NEW.registration_number, '');
    NEW.customer_name := COALESCE(NULLIF(NEW.customer_name, ''), NEW.patient_name, 'Walk-in Customer');
    NEW.customer_mobile := COALESCE(NEW.customer_mobile, NEW.mobile, '');
  END IF;

  IF NEW.status = 'Completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_pharmacy_order_before_insert ON public.pharmacy_orders;
CREATE TRIGGER prepare_pharmacy_order_before_insert
BEFORE INSERT ON public.pharmacy_orders
FOR EACH ROW
EXECUTE FUNCTION public.prepare_pharmacy_order();

DROP TRIGGER IF EXISTS prepare_pharmacy_order_before_update ON public.pharmacy_orders;
CREATE TRIGGER prepare_pharmacy_order_before_update
BEFORE UPDATE ON public.pharmacy_orders
FOR EACH ROW
EXECUTE FUNCTION public.prepare_pharmacy_order();