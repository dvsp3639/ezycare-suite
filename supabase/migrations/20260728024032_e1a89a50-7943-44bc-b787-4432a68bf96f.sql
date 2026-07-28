
-- Master specializations table
CREATE TABLE public.specializations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id uuid NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX specializations_hospital_name_uniq
  ON public.specializations (COALESCE(hospital_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specializations TO authenticated;
GRANT ALL ON public.specializations TO service_role;

ALTER TABLE public.specializations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specializations_select" ON public.specializations
  FOR SELECT TO authenticated
  USING (is_global OR hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "specializations_insert_admin" ON public.specializations
  FOR INSERT TO authenticated
  WITH CHECK (
    is_global = false
    AND hospital_id = public.get_user_hospital_id(auth.uid())
    AND (public.has_role(auth.uid(), 'hospital_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "specializations_update_admin" ON public.specializations
  FOR UPDATE TO authenticated
  USING (
    is_global = false
    AND hospital_id = public.get_user_hospital_id(auth.uid())
    AND (public.has_role(auth.uid(), 'hospital_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "specializations_delete_admin" ON public.specializations
  FOR DELETE TO authenticated
  USING (
    is_global = false
    AND hospital_id = public.get_user_hospital_id(auth.uid())
    AND (public.has_role(auth.uid(), 'hospital_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE TRIGGER specializations_updated_at BEFORE UPDATE ON public.specializations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Staff <-> specializations join table
CREATE TABLE public.staff_specializations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  specialization_id uuid NOT NULL REFERENCES public.specializations(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, specialization_id)
);
CREATE INDEX staff_specializations_staff_idx ON public.staff_specializations(staff_id);
CREATE INDEX staff_specializations_hospital_idx ON public.staff_specializations(hospital_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_specializations TO authenticated;
GRANT ALL ON public.staff_specializations TO service_role;

ALTER TABLE public.staff_specializations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_specializations_all" ON public.staff_specializations
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

-- Seed common global medical specializations
INSERT INTO public.specializations (hospital_id, name, is_global) VALUES
  (NULL, 'General Medicine', true),
  (NULL, 'General Surgery', true),
  (NULL, 'Cardiology', true),
  (NULL, 'Cardiothoracic Surgery', true),
  (NULL, 'Neurology', true),
  (NULL, 'Neurosurgery', true),
  (NULL, 'Orthopedics', true),
  (NULL, 'Pediatrics', true),
  (NULL, 'Neonatology', true),
  (NULL, 'Obstetrics & Gynecology', true),
  (NULL, 'Dermatology', true),
  (NULL, 'ENT (Otorhinolaryngology)', true),
  (NULL, 'Ophthalmology', true),
  (NULL, 'Psychiatry', true),
  (NULL, 'Radiology', true),
  (NULL, 'Anesthesiology', true),
  (NULL, 'Pathology', true),
  (NULL, 'Emergency Medicine', true),
  (NULL, 'Urology', true),
  (NULL, 'Nephrology', true),
  (NULL, 'Endocrinology', true),
  (NULL, 'Gastroenterology', true),
  (NULL, 'Pulmonology', true),
  (NULL, 'Oncology', true),
  (NULL, 'Hematology', true),
  (NULL, 'Rheumatology', true),
  (NULL, 'Plastic Surgery', true),
  (NULL, 'Dentistry', true),
  (NULL, 'Physiotherapy', true),
  (NULL, 'Infectious Diseases', true),
  (NULL, 'Family Medicine', true),
  (NULL, 'Ayurveda', true),
  (NULL, 'Homeopathy', true),
  (NULL, 'Diabetology', true),
  (NULL, 'Pain Management', true);
