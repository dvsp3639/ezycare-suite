DROP POLICY IF EXISTS "Authenticated update own hospital-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own hospital-assets" ON storage.objects;

CREATE POLICY "Authenticated update own hospital-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'hospital-assets'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = (public.get_user_hospital_id(auth.uid()))::text
)
WITH CHECK (
  bucket_id = 'hospital-assets'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = (public.get_user_hospital_id(auth.uid()))::text
);

CREATE POLICY "Authenticated delete own hospital-assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'hospital-assets'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = (public.get_user_hospital_id(auth.uid()))::text
);