
CREATE TABLE IF NOT EXISTS public.hospital_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL UNIQUE REFERENCES public.hospitals(id) ON DELETE CASCADE,
  basic jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  doctors jsonb NOT NULL DEFAULT '[]'::jsonb,
  facilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents jsonb NOT NULL DEFAULT '{}'::jsonb,
  signatures jsonb NOT NULL DEFAULT '{}'::jsonb,
  patient_app jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_profiles TO authenticated;
GRANT SELECT ON public.hospital_profiles TO anon;
GRANT ALL ON public.hospital_profiles TO service_role;

ALTER TABLE public.hospital_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published hospital profiles"
  ON public.hospital_profiles FOR SELECT
  USING (true);

CREATE POLICY "Hospital members can insert their profile"
  ON public.hospital_profiles FOR INSERT TO authenticated
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Hospital members can update their profile"
  ON public.hospital_profiles FOR UPDATE TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Hospital members can delete their profile"
  ON public.hospital_profiles FOR DELETE TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE TRIGGER hospital_profiles_updated_at
  BEFORE UPDATE ON public.hospital_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for hospital-assets bucket (public read; hospital-scoped write)
CREATE POLICY "Public read hospital-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hospital-assets');

CREATE POLICY "Authenticated upload hospital-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hospital-assets');

CREATE POLICY "Authenticated update own hospital-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'hospital-assets' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'hospital-assets' AND owner = auth.uid());

CREATE POLICY "Authenticated delete own hospital-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hospital-assets' AND owner = auth.uid());
