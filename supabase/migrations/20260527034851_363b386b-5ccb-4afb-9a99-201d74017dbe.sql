
-- 1. Deterministic hospital resolution
CREATE OR REPLACE FUNCTION public.get_user_hospital_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT hospital_id FROM public.user_roles
  WHERE user_id = _user_id AND hospital_id IS NOT NULL
  ORDER BY hospital_id ASC, id ASC
  LIMIT 1
$$;

-- 2. Lock down user_roles writes for everyone except super admins.
-- The existing "Super admins can manage all roles" policy is PERMISSIVE,
-- so this RESTRICTIVE policy combined with it produces: only super_admin can write.
DROP POLICY IF EXISTS "user_roles_block_self_modification" ON public.user_roles;
CREATE POLICY "user_roles_block_self_modification"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR (current_setting('request.method', true) = 'GET'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Note: the above keeps SELECT unaffected (USING returns true when no INSERT/UPDATE/DELETE happens
-- because PostgREST sets request.method). To be safe across all clients, replace with a write-only restrictive policy:
DROP POLICY IF EXISTS "user_roles_block_self_modification" ON public.user_roles;

CREATE POLICY "user_roles_only_super_admin_insert"
ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "user_roles_only_super_admin_update"
ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "user_roles_only_super_admin_delete"
ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Restrict staff_members (financial + government ID PII) to admins.
-- Drop the broad hospital_access policy and replace with admin-scoped one + self-view.
DROP POLICY IF EXISTS "hospital_access_staff_members" ON public.staff_members;

CREATE POLICY "staff_members_hospital_admin_access"
ON public.staff_members FOR ALL TO authenticated
USING (
  hospital_id = public.get_user_hospital_id(auth.uid())
  AND public.has_role(auth.uid(), 'hospital_admin'::app_role)
)
WITH CHECK (
  hospital_id = public.get_user_hospital_id(auth.uid())
  AND public.has_role(auth.uid(), 'hospital_admin'::app_role)
);

-- 4. Lab-reports bucket: make private and replace storage policies with hospital isolation.
UPDATE storage.buckets SET public = false WHERE id = 'lab-reports';

DROP POLICY IF EXISTS "Authenticated users can upload lab reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view lab reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete lab reports" ON storage.objects;

CREATE POLICY "lab_reports_hospital_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lab-reports'
  AND EXISTS (
    SELECT 1 FROM public.lab_orders lo
    WHERE lo.id::text = (storage.foldername(name))[1]
      AND lo.hospital_id = public.get_user_hospital_id(auth.uid())
  )
);

CREATE POLICY "lab_reports_hospital_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lab-reports'
  AND EXISTS (
    SELECT 1 FROM public.lab_orders lo
    WHERE lo.id::text = (storage.foldername(name))[1]
      AND lo.hospital_id = public.get_user_hospital_id(auth.uid())
  )
);

CREATE POLICY "lab_reports_hospital_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lab-reports'
  AND EXISTS (
    SELECT 1 FROM public.lab_orders lo
    WHERE lo.id::text = (storage.foldername(name))[1]
      AND lo.hospital_id = public.get_user_hospital_id(auth.uid())
  )
);

CREATE POLICY "lab_reports_super_admin_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'lab-reports' AND public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (bucket_id = 'lab-reports' AND public.has_role(auth.uid(), 'super_admin'::app_role));

-- 5. Revoke EXECUTE on SECURITY DEFINER helpers from anon/public so unauthenticated
-- requests cannot invoke them. Authenticated/service_role keep access (needed for RLS).
REVOKE EXECUTE ON FUNCTION public.create_pharmacy_sale(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_pharmacy_invoice_no(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_registration_number(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_hospital_id(uuid) FROM PUBLIC, anon;
