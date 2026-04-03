
CREATE TABLE public.composite_test_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_test_id uuid NOT NULL REFERENCES public.lab_test_catalog(id) ON DELETE CASCADE,
  child_test_id uuid NOT NULL REFERENCES public.lab_test_catalog(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_test_id, child_test_id)
);

ALTER TABLE public.composite_test_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_access_composite_test_items" ON public.composite_test_items
  FOR ALL TO authenticated
  USING (hospital_id = get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "super_admin_composite_test_items" ON public.composite_test_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER set_hospital_id_composite_test_items
  BEFORE INSERT ON public.composite_test_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
