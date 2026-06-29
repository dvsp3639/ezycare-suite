
-- Lab reports: add hospital-scoped UPDATE policy
CREATE POLICY "lab_reports_hospital_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'lab-reports' AND EXISTS (
    SELECT 1 FROM public.lab_orders lo
    WHERE lo.id::text = (storage.foldername(objects.name))[1]
      AND lo.hospital_id = public.get_user_hospital_id(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'lab-reports' AND EXISTS (
    SELECT 1 FROM public.lab_orders lo
    WHERE lo.id::text = (storage.foldername(objects.name))[1]
      AND lo.hospital_id = public.get_user_hospital_id(auth.uid())
  )
);

-- Purchase invoices: switch from owner-only to hospital-scoped access (keep owner OR same hospital)
DROP POLICY IF EXISTS "Staff can read their invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update their invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete their invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload invoice files" ON storage.objects;

CREATE POLICY "purchase_invoices_hospital_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'purchase-invoices' AND (
    auth.uid() = owner OR EXISTS (
      SELECT 1 FROM public.purchase_bills pb
      WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
        AND (
          pb.invoice_file_url = objects.name
          OR pb.source_files::text LIKE '%' || objects.name || '%'
        )
    )
  )
);

CREATE POLICY "purchase_invoices_hospital_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'purchase-invoices'
  AND auth.uid() = owner
  AND public.get_user_hospital_id(auth.uid()) IS NOT NULL
);

CREATE POLICY "purchase_invoices_hospital_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'purchase-invoices' AND (
    auth.uid() = owner OR EXISTS (
      SELECT 1 FROM public.purchase_bills pb
      WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
        AND (pb.invoice_file_url = objects.name OR pb.source_files::text LIKE '%' || objects.name || '%')
    )
  )
)
WITH CHECK (
  bucket_id = 'purchase-invoices' AND (
    auth.uid() = owner OR EXISTS (
      SELECT 1 FROM public.purchase_bills pb
      WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
        AND (pb.invoice_file_url = objects.name OR pb.source_files::text LIKE '%' || objects.name || '%')
    )
  )
);

CREATE POLICY "purchase_invoices_hospital_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'purchase-invoices' AND (
    auth.uid() = owner OR EXISTS (
      SELECT 1 FROM public.purchase_bills pb
      WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
        AND (pb.invoice_file_url = objects.name OR pb.source_files::text LIKE '%' || objects.name || '%')
    )
  )
);
