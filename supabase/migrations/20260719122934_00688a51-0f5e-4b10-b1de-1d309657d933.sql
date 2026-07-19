-- Allow hospital members to upload assets into their own hospital folder
CREATE POLICY "Hospital members insert hospital-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hospital-assets'
  AND (storage.foldername(name))[1] = public.get_user_hospital_id(auth.uid())::text
);