
-- =========================================================
-- 1. AI toggle on hospitals
-- =========================================================
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;

-- =========================================================
-- 2. Hospital subscriptions
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('trial','basic','professional','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','suspended','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.hospital_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL UNIQUE REFERENCES public.hospitals(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'trial',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  max_users integer,
  max_patients_per_month integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_subscriptions TO authenticated;
GRANT ALL ON public.hospital_subscriptions TO service_role;
ALTER TABLE public.hospital_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage_subs" ON public.hospital_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "hospital_read_own_sub" ON public.hospital_subscriptions
  FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE TRIGGER trg_hospital_subs_updated
  BEFORE UPDATE ON public.hospital_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.hospital_subscriptions (hospital_id, plan, status, trial_ends_at, current_period_end)
SELECT h.id, 'trial', 'trialing', now() + interval '30 days', now() + interval '30 days'
FROM public.hospitals h
WHERE NOT EXISTS (SELECT 1 FROM public.hospital_subscriptions s WHERE s.hospital_id = h.id);

-- =========================================================
-- 3. AI usage events
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.ai_feature AS ENUM ('prescription_scan','invoice_scan','universal_search','voice_transcribe','medicine_scan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_event_status AS ENUM ('success','error','low_confidence','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id uuid,
  feature public.ai_feature NOT NULL,
  model text,
  status public.ai_event_status NOT NULL DEFAULT 'success',
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  confidence_score numeric(5,2),
  was_corrected boolean NOT NULL DEFAULT false,
  correction_delta jsonb,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_hospital_date ON public.ai_usage_events (hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage_events (feature, created_at DESC);

GRANT SELECT, INSERT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_all_ai_usage" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "hospital_read_own_ai_usage" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "authenticated_insert_ai_usage" ON public.ai_usage_events
  FOR INSERT TO authenticated
  WITH CHECK (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- =========================================================
-- 4. Support tickets
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','waiting_customer','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_category AS ENUM ('bug','feature','billing','ai','training','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  ticket_no text NOT NULL,
  created_by uuid NOT NULL,
  subject text NOT NULL,
  description text,
  category public.ticket_category NOT NULL DEFAULT 'other',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'open',
  assigned_to uuid,
  sla_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  hospital_unread_count integer NOT NULL DEFAULT 0,
  admin_unread_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_no ON public.support_tickets(ticket_no);
CREATE INDEX IF NOT EXISTS idx_tickets_hospital ON public.support_tickets(hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status, priority, sla_due_at);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "hospital_read_own_tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "hospital_admin_create_tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND public.has_role(auth.uid(),'hospital_admin')
    AND created_by = auth.uid()
  );

CREATE POLICY "hospital_admin_update_own_tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND public.has_role(auth.uid(),'hospital_admin')
  )
  WITH CHECK (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND public.has_role(auth.uid(),'hospital_admin')
  );

CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tmsgs_ticket ON public.support_ticket_messages(ticket_id, created_at);

GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_ticket_msgs" ON public.support_ticket_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "hospital_read_own_ticket_msgs" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    internal_note = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.hospital_id = public.get_user_hospital_id(auth.uid())
    )
  );

CREATE POLICY "hospital_reply_own_ticket_msgs" ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    internal_note = false
    AND sender_role = 'hospital'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.hospital_id = public.get_user_hospital_id(auth.uid())
    )
  );

CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 1000;

CREATE OR REPLACE FUNCTION public.assign_ticket_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _sla interval;
BEGIN
  IF NEW.ticket_no IS NULL OR NEW.ticket_no = '' THEN
    NEW.ticket_no := 'TKT-' || to_char(now(),'YYYY') || '-' || nextval('public.support_ticket_seq')::text;
  END IF;
  IF NEW.sla_due_at IS NULL THEN
    _sla := CASE NEW.priority
      WHEN 'urgent' THEN interval '2 hours'
      WHEN 'high'   THEN interval '8 hours'
      WHEN 'medium' THEN interval '24 hours'
      ELSE               interval '72 hours'
    END;
    NEW.sla_due_at := now() + _sla;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_ticket_defaults
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.assign_ticket_defaults();

CREATE OR REPLACE FUNCTION public.on_ticket_message_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.internal_note THEN RETURN NEW; END IF;
  UPDATE public.support_tickets t
    SET last_message_at = NEW.created_at,
        first_response_at = COALESCE(
          t.first_response_at,
          CASE WHEN NEW.sender_role = 'super_admin' THEN NEW.created_at ELSE t.first_response_at END
        ),
        hospital_unread_count = CASE WHEN NEW.sender_role = 'super_admin'
                                     THEN t.hospital_unread_count + 1 ELSE t.hospital_unread_count END,
        admin_unread_count    = CASE WHEN NEW.sender_role = 'hospital'
                                     THEN t.admin_unread_count + 1 ELSE t.admin_unread_count END,
        status = CASE
          WHEN t.status = 'resolved' AND NEW.sender_role = 'hospital' THEN 'open'::public.ticket_status
          WHEN t.status = 'open' AND NEW.sender_role = 'super_admin' THEN 'in_progress'::public.ticket_status
          ELSE t.status
        END
    WHERE t.id = NEW.ticket_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_ticket_msg_after_insert
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.on_ticket_message_insert();

-- Storage RLS on support-attachments bucket
CREATE POLICY "support_attach_super_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'support-attachments' AND public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (bucket_id = 'support-attachments' AND public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "support_attach_hospital_admin_own"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND public.has_role(auth.uid(),'hospital_admin')
    AND (storage.foldername(name))[1] = public.get_user_hospital_id(auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND public.has_role(auth.uid(),'hospital_admin')
    AND (storage.foldername(name))[1] = public.get_user_hospital_id(auth.uid())::text
  );
