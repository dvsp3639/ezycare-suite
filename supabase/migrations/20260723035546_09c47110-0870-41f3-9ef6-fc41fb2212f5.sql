
DROP POLICY IF EXISTS purchase_invoices_hospital_select ON storage.objects;
DROP POLICY IF EXISTS purchase_invoices_hospital_update ON storage.objects;
DROP POLICY IF EXISTS purchase_invoices_hospital_delete ON storage.objects;

CREATE POLICY purchase_invoices_hospital_select ON storage.objects
FOR SELECT USING (
  bucket_id = 'purchase-invoices'
  AND EXISTS (
    SELECT 1 FROM public.purchase_bills pb
    WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
      AND (
        pb.invoice_file_url = storage.objects.name
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f
          WHERE (f.value->>'storage_path') = storage.objects.name
        )
      )
  )
);

CREATE POLICY purchase_invoices_hospital_update ON storage.objects
FOR UPDATE USING (
  bucket_id = 'purchase-invoices'
  AND EXISTS (
    SELECT 1 FROM public.purchase_bills pb
    WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
      AND (
        pb.invoice_file_url = storage.objects.name
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f
          WHERE (f.value->>'storage_path') = storage.objects.name
        )
      )
  )
) WITH CHECK (
  bucket_id = 'purchase-invoices'
  AND EXISTS (
    SELECT 1 FROM public.purchase_bills pb
    WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
      AND (
        pb.invoice_file_url = storage.objects.name
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f
          WHERE (f.value->>'storage_path') = storage.objects.name
        )
      )
  )
);

CREATE POLICY purchase_invoices_hospital_delete ON storage.objects
FOR DELETE USING (
  bucket_id = 'purchase-invoices'
  AND EXISTS (
    SELECT 1 FROM public.purchase_bills pb
    WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
      AND (
        pb.invoice_file_url = storage.objects.name
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f
          WHERE (f.value->>'storage_path') = storage.objects.name
        )
      )
  )
);
