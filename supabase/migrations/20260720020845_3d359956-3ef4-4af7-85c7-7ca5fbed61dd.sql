
-- 1) Revoke anon execute on SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.generate_doctor_slots(text, date, date) FROM PUBLIC, anon;

-- 2) Drop public hospital_profiles read policy (sensitive jsonb fields)
DROP POLICY IF EXISTS "Public can read published hospital profiles" ON public.hospital_profiles;

-- 3) Replace fragile LIKE matching on purchase-invoices storage with jsonb containment
DROP POLICY IF EXISTS purchase_invoices_hospital_select ON storage.objects;
DROP POLICY IF EXISTS purchase_invoices_hospital_update ON storage.objects;
DROP POLICY IF EXISTS purchase_invoices_hospital_delete ON storage.objects;

CREATE POLICY purchase_invoices_hospital_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'purchase-invoices'
  AND (
    auth.uid() = owner
    OR EXISTS (
      SELECT 1 FROM public.purchase_bills pb
      WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
        AND (
          pb.invoice_file_url = objects.name
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f
            WHERE f->>'storage_path' = objects.name
          )
        )
    )
  )
);

CREATE POLICY purchase_invoices_hospital_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'purchase-invoices'
  AND (
    auth.uid() = owner
    OR EXISTS (
      SELECT 1 FROM public.purchase_bills pb
      WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
        AND (
          pb.invoice_file_url = objects.name
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f
            WHERE f->>'storage_path' = objects.name
          )
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'purchase-invoices'
  AND (
    auth.uid() = owner
    OR EXISTS (
      SELECT 1 FROM public.purchase_bills pb
      WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
        AND (
          pb.invoice_file_url = objects.name
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f
            WHERE f->>'storage_path' = objects.name
          )
        )
    )
  )
);

CREATE POLICY purchase_invoices_hospital_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'purchase-invoices'
  AND (
    auth.uid() = owner
    OR EXISTS (
      SELECT 1 FROM public.purchase_bills pb
      WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
        AND (
          pb.invoice_file_url = objects.name
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f
            WHERE f->>'storage_path' = objects.name
          )
        )
    )
  )
);

-- 4) registration_counters: ensure super_admin override policy is present (idempotent)
DROP POLICY IF EXISTS super_admin_registration_counters ON public.registration_counters;
CREATE POLICY super_admin_registration_counters ON public.registration_counters
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
