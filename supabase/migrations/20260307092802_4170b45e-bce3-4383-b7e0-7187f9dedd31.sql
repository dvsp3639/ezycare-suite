
CREATE TABLE public.user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_access_user_module_permissions" ON public.user_module_permissions
  FOR ALL TO authenticated
  USING (hospital_id = get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "super_admin_user_module_permissions" ON public.user_module_permissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "users_read_own_permissions" ON public.user_module_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
