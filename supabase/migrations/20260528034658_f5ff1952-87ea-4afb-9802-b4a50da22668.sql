
-- Tighten salary_records: only hospital_admin / super_admin (mirror staff_members pattern)
DROP POLICY IF EXISTS hospital_access_salary_records ON public.salary_records;
CREATE POLICY hospital_access_salary_records ON public.salary_records
  FOR ALL TO authenticated
  USING (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND (public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND (public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  );

-- Tighten salary_advances: only hospital_admin / super_admin
DROP POLICY IF EXISTS hospital_access_salary_advances ON public.salary_advances;
CREATE POLICY hospital_access_salary_advances ON public.salary_advances
  FOR ALL TO authenticated
  USING (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND (public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND (public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  );

-- Restrict writes on attendance_records to hospital_admin / super_admin (reads remain hospital-scoped)
CREATE POLICY attendance_records_admin_write ON public.attendance_records
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
CREATE POLICY attendance_records_admin_update ON public.attendance_records
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
CREATE POLICY attendance_records_admin_delete ON public.attendance_records
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Restrict writes on leave_requests to hospital_admin / super_admin
CREATE POLICY leave_requests_admin_write ON public.leave_requests
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
CREATE POLICY leave_requests_admin_update ON public.leave_requests
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
CREATE POLICY leave_requests_admin_delete ON public.leave_requests
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Restrict writes on user_module_permissions to hospital_admin / super_admin (prevent privilege escalation)
CREATE POLICY user_module_permissions_admin_insert ON public.user_module_permissions
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
CREATE POLICY user_module_permissions_admin_update ON public.user_module_permissions
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
CREATE POLICY user_module_permissions_admin_delete ON public.user_module_permissions
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hospital_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
