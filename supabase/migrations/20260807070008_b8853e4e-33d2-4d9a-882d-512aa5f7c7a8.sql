ALTER TABLE public.daycare_sessions
  ADD COLUMN IF NOT EXISTS department text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS chief_complaint text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS remarks text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS final_diagnosis text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS doctor_advice text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS discharge_medicines text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS followup_date date,
  ADD COLUMN IF NOT EXISTS discharge_instructions text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS doctor_charge numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nursing_charge numeric(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.daycare_case_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.daycare_sessions(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('procedure','medicine','consumable','investigation')),
  ref_id uuid,
  name text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  dosage text DEFAULT ''::text,
  frequency text DEFAULT ''::text,
  duration text DEFAULT ''::text,
  doctor_name text DEFAULT ''::text,
  status text NOT NULL DEFAULT 'Pending',
  notes text DEFAULT ''::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daycare_case_items TO authenticated;
GRANT ALL ON public.daycare_case_items TO service_role;
ALTER TABLE public.daycare_case_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospital_access_daycare_case_items" ON public.daycare_case_items
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_daycare_case_items" ON public.daycare_case_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER set_hospital_id_daycare_case_items BEFORE INSERT ON public.daycare_case_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
CREATE TRIGGER update_timestamp_daycare_case_items BEFORE UPDATE ON public.daycare_case_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_timestamp();
CREATE INDEX IF NOT EXISTS idx_daycare_case_items_session ON public.daycare_case_items(session_id);

CREATE TABLE IF NOT EXISTS public.daycare_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.daycare_sessions(id) ON DELETE CASCADE,
  event text NOT NULL,
  details text DEFAULT ''::text,
  actor text DEFAULT ''::text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.daycare_timeline TO authenticated;
GRANT ALL ON public.daycare_timeline TO service_role;
ALTER TABLE public.daycare_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospital_read_daycare_timeline" ON public.daycare_timeline
  FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "hospital_insert_daycare_timeline" ON public.daycare_timeline
  FOR INSERT TO authenticated
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER set_hospital_id_daycare_timeline BEFORE INSERT ON public.daycare_timeline
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
CREATE INDEX IF NOT EXISTS idx_daycare_timeline_session ON public.daycare_timeline(session_id, created_at);