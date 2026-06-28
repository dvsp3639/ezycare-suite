
CREATE TABLE public.pharmacy_workspace_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'scan',
  verification_status text NOT NULL DEFAULT 'pending',
  billing_status text NOT NULL DEFAULT 'pending',
  patient_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  doctor_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sale_type text NOT NULL DEFAULT 'OP Sale',
  ai_confidence numeric,
  page_count integer NOT NULL DEFAULT 0,
  source_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  linked_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_workspace_scans TO authenticated;
GRANT ALL ON public.pharmacy_workspace_scans TO service_role;

ALTER TABLE public.pharmacy_workspace_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their own workspace scans"
  ON public.pharmacy_workspace_scans FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners insert their own workspace scans"
  ON public.pharmacy_workspace_scans FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners update their own workspace scans"
  ON public.pharmacy_workspace_scans FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners delete their own workspace scans"
  ON public.pharmacy_workspace_scans FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE INDEX idx_pws_owner_active ON public.pharmacy_workspace_scans (owner_user_id, completed_at, cancelled_at, created_at DESC);

CREATE TRIGGER pws_set_hospital
  BEFORE INSERT ON public.pharmacy_workspace_scans
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();

CREATE TRIGGER pws_touch_updated
  BEFORE UPDATE ON public.pharmacy_workspace_scans
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_timestamp();

ALTER TABLE public.pharmacy_workspace_scans REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pharmacy_workspace_scans;
