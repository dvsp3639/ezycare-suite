
DROP POLICY IF EXISTS "Authenticated upload hospital-assets" ON storage.objects;
CREATE POLICY "Authenticated upload hospital-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hospital-assets'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = public.get_user_hospital_id(auth.uid())::text
  );

DROP POLICY IF EXISTS "Public read hospital-assets" ON storage.objects;
CREATE POLICY "Hospital members read hospital-assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'hospital-assets'
    AND (storage.foldername(name))[1] = public.get_user_hospital_id(auth.uid())::text
  );

DROP POLICY IF EXISTS "Public can read published hospital profiles" ON public.hospital_profiles;
CREATE POLICY "Public can read published hospital profiles" ON public.hospital_profiles
  FOR SELECT TO public
  USING (published = true);
