
-- 1. Corrections table for AI learning
CREATE TABLE IF NOT EXISTS public.prescription_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  doctor_name text NOT NULL DEFAULT '',
  ai_text text NOT NULL,
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE CASCADE,
  medicine_name text NOT NULL DEFAULT '',
  picks integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (hospital_id, doctor_name, ai_text)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_corrections TO authenticated;
GRANT ALL ON public.prescription_corrections TO service_role;

ALTER TABLE public.prescription_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rx_corr_select_same_hospital" ON public.prescription_corrections
  FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "rx_corr_insert_same_hospital" ON public.prescription_corrections
  FOR INSERT TO authenticated
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "rx_corr_update_same_hospital" ON public.prescription_corrections
  FOR UPDATE TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "rx_corr_delete_same_hospital" ON public.prescription_corrections
  FOR DELETE TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rx_corr_lookup
  ON public.prescription_corrections (hospital_id, doctor_name, ai_text);

-- 2. RPC: record a manual correction
CREATE OR REPLACE FUNCTION public.record_rx_correction(
  _doctor_name text,
  _ai_text text,
  _medicine_id uuid,
  _medicine_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hospital_id uuid;
  _user_id uuid := auth.uid();
  _ai_norm text := lower(trim(_ai_text));
BEGIN
  IF _user_id IS NULL OR _ai_norm = '' THEN RETURN; END IF;
  _hospital_id := public.get_user_hospital_id(_user_id);
  IF _hospital_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.prescription_corrections
    (hospital_id, doctor_name, ai_text, medicine_id, medicine_name, picks, last_used_at, created_by)
  VALUES
    (_hospital_id, COALESCE(lower(trim(_doctor_name)),''), _ai_norm, _medicine_id, COALESCE(_medicine_name,''), 1, now(), _user_id)
  ON CONFLICT (hospital_id, doctor_name, ai_text) DO UPDATE
    SET medicine_id = EXCLUDED.medicine_id,
        medicine_name = EXCLUDED.medicine_name,
        picks = public.prescription_corrections.picks + 1,
        last_used_at = now();
END;
$$;

-- 3. Extend prescription_scans for full audit trail
ALTER TABLE public.prescription_scans
  ADD COLUMN IF NOT EXISTS pages jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enhanced_file_path text,
  ADD COLUMN IF NOT EXISTS corrections jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS barcode_verifications jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispensed_by uuid,
  ADD COLUMN IF NOT EXISTS dispensed_by_name text,
  ADD COLUMN IF NOT EXISTS dispensed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_id text;
