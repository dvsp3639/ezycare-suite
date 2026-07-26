
-- 1. Restrict purchase-invoices storage policies to authenticated role
DROP POLICY IF EXISTS purchase_invoices_hospital_select ON storage.objects;
DROP POLICY IF EXISTS purchase_invoices_hospital_update ON storage.objects;
DROP POLICY IF EXISTS purchase_invoices_hospital_delete ON storage.objects;

CREATE POLICY purchase_invoices_hospital_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'purchase-invoices' AND EXISTS (
    SELECT 1 FROM public.purchase_bills pb
    WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
      AND (pb.invoice_file_url = objects.name OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f(value)
        WHERE (f.value ->> 'storage_path') = objects.name
      ))
  )
);

CREATE POLICY purchase_invoices_hospital_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'purchase-invoices' AND EXISTS (
    SELECT 1 FROM public.purchase_bills pb
    WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
      AND (pb.invoice_file_url = objects.name OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f(value)
        WHERE (f.value ->> 'storage_path') = objects.name
      ))
  )
)
WITH CHECK (
  bucket_id = 'purchase-invoices' AND EXISTS (
    SELECT 1 FROM public.purchase_bills pb
    WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
      AND (pb.invoice_file_url = objects.name OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f(value)
        WHERE (f.value ->> 'storage_path') = objects.name
      ))
  )
);

CREATE POLICY purchase_invoices_hospital_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'purchase-invoices' AND EXISTS (
    SELECT 1 FROM public.purchase_bills pb
    WHERE pb.hospital_id = public.get_user_hospital_id(auth.uid())
      AND (pb.invoice_file_url = objects.name OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(pb.source_files, '[]'::jsonb)) f(value)
        WHERE (f.value ->> 'storage_path') = objects.name
      ))
  )
);

-- 2. Add explicit restrictive deny policies for UPDATE/DELETE on support_ticket_messages
--    Super admins still allowed via existing permissive super_admin_all_ticket_msgs policy.
CREATE POLICY hospital_no_update_ticket_msgs ON public.support_ticket_messages
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY hospital_no_delete_ticket_msgs ON public.support_ticket_messages
AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Harden get_user_hospital_id to be fail-closed when the caller has roles in
--    more than one hospital, eliminating silent misassignment.
CREATE OR REPLACE FUNCTION public.get_user_hospital_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _count int;
  _hospital uuid;
BEGIN
  SELECT count(DISTINCT hospital_id), min(hospital_id)
    INTO _count, _hospital
  FROM public.user_roles
  WHERE user_id = _user_id AND hospital_id IS NOT NULL;

  IF _count > 1 THEN
    -- Ambiguous multi-hospital user: fail closed so RLS never silently
    -- resolves to just one hospital.
    RAISE EXCEPTION 'User % has roles in multiple hospitals; active hospital must be set explicitly', _user_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN _hospital;
END;
$function$;
