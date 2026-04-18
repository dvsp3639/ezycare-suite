
-- Operating expenses ledger (rent, utilities, misc)
CREATE TABLE public.operating_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT DEFAULT 'Cash',
  vendor TEXT DEFAULT '',
  reference_no TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_access_operating_expenses" ON public.operating_expenses
  FOR ALL TO authenticated
  USING (hospital_id = get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "super_admin_operating_expenses" ON public.operating_expenses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_operating_expenses_updated_at
  BEFORE UPDATE ON public.operating_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_operating_expenses_hospital_date ON public.operating_expenses(hospital_id, expense_date DESC);

-- Inventory & pharmacy purchases (vendor bills)
CREATE TABLE public.purchase_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bill_type TEXT NOT NULL DEFAULT 'Pharmacy', -- 'Pharmacy' | 'Inventory'
  vendor TEXT NOT NULL DEFAULT '',
  invoice_no TEXT DEFAULT '',
  subtotal NUMERIC DEFAULT 0,
  gst_amount NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT DEFAULT 'Cash',
  payment_status TEXT DEFAULT 'Paid', -- 'Paid' | 'Pending' | 'Partial'
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_access_purchase_bills" ON public.purchase_bills
  FOR ALL TO authenticated
  USING (hospital_id = get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "super_admin_purchase_bills" ON public.purchase_bills
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_purchase_bills_updated_at
  BEFORE UPDATE ON public.purchase_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_purchase_bills_hospital_date ON public.purchase_bills(hospital_id, bill_date DESC);

-- Add consultation fee + payment fields to appointments so OPD revenue is real
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash',
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Paid';
