
-- 1. Prescription scans table
CREATE TABLE public.prescription_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  scanned_by uuid REFERENCES auth.users(id),
  scanned_by_name text,
  verified_by uuid REFERENCES auth.users(id),
  verified_by_name text,
  patient_id uuid,
  patient_name text,
  registration_number text,
  doctor_name text,
  hospital_name text,
  prescription_date date,
  source_file_path text,
  source_file_mime text,
  extracted_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  manual_corrections jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  substitutions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'extracted', -- extracted | verified | dispensed | cancelled
  pharmacy_order_id uuid,
  device_info text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_scans TO authenticated;
GRANT ALL ON public.prescription_scans TO service_role;

ALTER TABLE public.prescription_scans ENABLE ROW LEVEL SECURITY;

-- Auto-set hospital_id from current user
CREATE TRIGGER prescription_scans_set_hospital
  BEFORE INSERT ON public.prescription_scans
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();

CREATE TRIGGER prescription_scans_updated_at
  BEFORE UPDATE ON public.prescription_scans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Hospital staff read prescription scans"
  ON public.prescription_scans FOR SELECT
  TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Hospital staff manage prescription scans"
  ON public.prescription_scans FOR ALL
  TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE INDEX idx_prescription_scans_hospital_created
  ON public.prescription_scans (hospital_id, created_at DESC);
CREATE INDEX idx_prescription_scans_patient
  ON public.prescription_scans (patient_id);

-- 2. Link pharmacy orders back to their source prescription
ALTER TABLE public.pharmacy_orders
  ADD COLUMN IF NOT EXISTS prescription_scan_id uuid;

-- 3. Storage RLS for `prescriptions` bucket (per-user folders)
CREATE POLICY "Auth users upload to own prescription folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth users read prescription files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prescriptions');

CREATE POLICY "Auth users update own prescription files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users delete own prescription files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);
