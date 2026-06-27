CREATE TABLE public.scanner_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  user_id uuid NOT NULL,
  source_type text NOT NULL,
  field text NOT NULL,
  ai_value text,
  corrected_value text,
  medicine_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.scanner_corrections TO authenticated;
GRANT ALL ON public.scanner_corrections TO service_role;
ALTER TABLE public.scanner_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert their hospital corrections"
  ON public.scanner_corrections FOR INSERT TO authenticated
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Users view their hospital corrections"
  ON public.scanner_corrections FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE INDEX idx_scanner_corrections_hospital ON public.scanner_corrections(hospital_id, created_at DESC);