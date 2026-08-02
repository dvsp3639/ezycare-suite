DROP POLICY IF EXISTS "Hospital members insert hospital-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload hospital-assets" ON storage.objects;

CREATE POLICY "Hospital members upload hospital-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hospital-assets'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = (public.get_user_hospital_id(auth.uid()))::text
);