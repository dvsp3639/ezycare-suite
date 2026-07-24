DROP POLICY IF EXISTS "purchase_invoices_hospital_insert" ON storage.objects;
CREATE POLICY "purchase_invoices_hospital_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'purchase-invoices'
  AND auth.uid() = owner
  AND public.get_user_hospital_id(auth.uid()) IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_user_hospital_id(auth.uid())::text
  AND (storage.foldername(name))[2] = auth.uid()::text
);