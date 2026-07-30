
-- ============ toggles ============
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS followup_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS reminder_consent boolean NOT NULL DEFAULT true;

-- ============ hospital policy ============
CREATE TABLE public.followup_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL UNIQUE REFERENCES public.hospitals(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  window_days integer NOT NULL DEFAULT 7,
  max_visits integer NOT NULL DEFAULT 1,
  doctor_wise boolean NOT NULL DEFAULT true,
  department_wise boolean NOT NULL DEFAULT false,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_days integer[] NOT NULL DEFAULT ARRAY[5,2,0],
  sms_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  push_enabled boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_policies TO authenticated;
GRANT ALL ON public.followup_policies TO service_role;
ALTER TABLE public.followup_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followup_policies_hospital" ON public.followup_policies FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER followup_policies_touch BEFORE UPDATE ON public.followup_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ doctor policy ============
CREATE TABLE public.followup_doctor_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  doctor_name text NOT NULL,
  department text,
  enabled boolean NOT NULL DEFAULT true,
  window_days integer,
  max_visits integer,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, doctor_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_doctor_policies TO authenticated;
GRANT ALL ON public.followup_doctor_policies TO service_role;
ALTER TABLE public.followup_doctor_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followup_doctor_policies_hospital" ON public.followup_doctor_policies FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER followup_doctor_policies_touch BEFORE UPDATE ON public.followup_doctor_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ entitlements ============
CREATE TABLE public.followup_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid,
  registration_number text NOT NULL DEFAULT '',
  patient_name text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  doctor_name text NOT NULL,
  department text,
  source_appointment_id uuid,
  source_visit_date date NOT NULL,
  expiry_date date NOT NULL,
  max_visits integer NOT NULL DEFAULT 1,
  used_visits integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  consent boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fu_ent_hospital_status ON public.followup_entitlements(hospital_id, status, expiry_date);
CREATE INDEX idx_fu_ent_mobile ON public.followup_entitlements(hospital_id, mobile);
CREATE INDEX idx_fu_ent_reg ON public.followup_entitlements(hospital_id, registration_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_entitlements TO authenticated;
GRANT ALL ON public.followup_entitlements TO service_role;
ALTER TABLE public.followup_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followup_entitlements_hospital" ON public.followup_entitlements FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER followup_entitlements_touch BEFORE UPDATE ON public.followup_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ visits ============
CREATE TABLE public.followup_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL REFERENCES public.followup_entitlements(id) ON DELETE CASCADE,
  appointment_id uuid,
  source_appointment_id uuid,
  token_no integer,
  visit_date date NOT NULL,
  doctor_name text NOT NULL,
  status text NOT NULL DEFAULT 'Booked',
  booked_by uuid,
  channel text NOT NULL DEFAULT 'reception',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fu_visits_hospital_date ON public.followup_visits(hospital_id, visit_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_visits TO authenticated;
GRANT ALL ON public.followup_visits TO service_role;
ALTER TABLE public.followup_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followup_visits_hospital" ON public.followup_visits FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER followup_visits_touch BEFORE UPDATE ON public.followup_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ reminders ============
CREATE TABLE public.followup_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL REFERENCES public.followup_entitlements(id) ON DELETE CASCADE,
  channel text NOT NULL,
  scheduled_for date NOT NULL,
  offset_days integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  message text,
  provider_ref text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entitlement_id, channel, offset_days)
);
CREATE INDEX idx_fu_rem_due ON public.followup_reminders(hospital_id, status, scheduled_for);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_reminders TO authenticated;
GRANT ALL ON public.followup_reminders TO service_role;
ALTER TABLE public.followup_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followup_reminders_hospital" ON public.followup_reminders FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER followup_reminders_touch BEFORE UPDATE ON public.followup_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ audit ============
CREATE TABLE public.followup_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fu_audit_hospital ON public.followup_audit_log(hospital_id, created_at DESC);
GRANT SELECT, INSERT ON public.followup_audit_log TO authenticated;
GRANT ALL ON public.followup_audit_log TO service_role;
ALTER TABLE public.followup_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followup_audit_select" ON public.followup_audit_log FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "followup_audit_insert" ON public.followup_audit_log FOR INSERT TO authenticated
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

-- ============ auto-grant entitlement on completed consultation ============
CREATE OR REPLACE FUNCTION public.grant_followup_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pol public.followup_policies%ROWTYPE;
  _doc public.followup_doctor_policies%ROWTYPE;
  _hosp_on boolean;
  _window int;
  _max int;
  _consent boolean := true;
  _pid uuid;
  _mobile text := '';
  _dept text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'Completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'Completed' THEN RETURN NEW; END IF;

  SELECT followup_enabled INTO _hosp_on FROM public.hospitals WHERE id = NEW.hospital_id;
  IF COALESCE(_hosp_on, false) = false THEN RETURN NEW; END IF;

  SELECT * INTO _pol FROM public.followup_policies WHERE hospital_id = NEW.hospital_id;
  IF NOT FOUND OR _pol.enabled = false THEN RETURN NEW; END IF;

  SELECT * INTO _doc FROM public.followup_doctor_policies
    WHERE hospital_id = NEW.hospital_id AND lower(doctor_name) = lower(NEW.doctor_name);
  IF _pol.doctor_wise AND FOUND AND _doc.enabled = false THEN RETURN NEW; END IF;

  _window := COALESCE(CASE WHEN _pol.doctor_wise THEN _doc.window_days END, _pol.window_days);
  _max    := COALESCE(CASE WHEN _pol.doctor_wise THEN _doc.max_visits END, _pol.max_visits);
  _dept   := _doc.department;

  SELECT p.id, p.mobile, p.reminder_consent INTO _pid, _mobile, _consent
    FROM public.patients p
    WHERE p.hospital_id = NEW.hospital_id AND p.registration_number = NEW.registration_number
    LIMIT 1;

  -- avoid duplicate entitlement for the same source appointment
  IF EXISTS (SELECT 1 FROM public.followup_entitlements WHERE source_appointment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.followup_entitlements (
    hospital_id, patient_id, registration_number, patient_name, mobile,
    doctor_name, department, source_appointment_id, source_visit_date,
    expiry_date, max_visits, used_visits, status, consent
  ) VALUES (
    NEW.hospital_id, _pid, COALESCE(NEW.registration_number,''), NEW.patient_name, COALESCE(_mobile,''),
    NEW.doctor_name, _dept, NEW.id, NEW.appointment_date,
    NEW.appointment_date + _window, GREATEST(1,_max), 0, 'active', COALESCE(_consent,true)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_followup ON public.appointments;
CREATE TRIGGER trg_grant_followup
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.grant_followup_entitlement();

-- ============ booking RPC ============
CREATE OR REPLACE FUNCTION public.book_followup_visit(
  _entitlement_id uuid,
  _appointment_date date,
  _time_slot text DEFAULT NULL,
  _channel text DEFAULT 'reception'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _e public.followup_entitlements%ROWTYPE;
  _hid uuid := public.get_user_hospital_id(auth.uid());
  _token int;
  _appt public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO _e FROM public.followup_entitlements WHERE id = _entitlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Follow-up entitlement not found'; END IF;
  IF _hid IS NULL OR _e.hospital_id <> _hid THEN RAISE EXCEPTION 'Not allowed for this hospital'; END IF;
  IF _e.status <> 'active' THEN RAISE EXCEPTION 'Follow-up is no longer active (%).', _e.status; END IF;
  IF _e.used_visits >= _e.max_visits THEN RAISE EXCEPTION 'All free follow-up visits already used'; END IF;
  IF _appointment_date > _e.expiry_date THEN RAISE EXCEPTION 'Follow-up window expired on %', _e.expiry_date; END IF;

  SELECT COALESCE(MAX(token_no),0)+1 INTO _token FROM public.appointments
    WHERE hospital_id = _e.hospital_id AND appointment_date = _appointment_date
      AND lower(doctor_name) = lower(_e.doctor_name);

  INSERT INTO public.appointments (
    hospital_id, token_no, patient_id, patient_name, registration_number,
    doctor_name, time_slot, opd_type, status, appointment_date,
    consultation_fee, payment_mode, payment_status
  ) VALUES (
    _e.hospital_id, _token, _e.patient_id, _e.patient_name, _e.registration_number,
    _e.doctor_name, _time_slot, 'Follow-up', 'Waiting', _appointment_date,
    0, 'Free Follow-up', 'Waived'
  ) RETURNING * INTO _appt;

  INSERT INTO public.followup_visits (
    hospital_id, entitlement_id, appointment_id, source_appointment_id,
    token_no, visit_date, doctor_name, status, booked_by, channel
  ) VALUES (
    _e.hospital_id, _e.id, _appt.id, _e.source_appointment_id,
    _token, _appointment_date, _e.doctor_name, 'Booked', auth.uid(), _channel
  );

  UPDATE public.followup_entitlements
    SET used_visits = used_visits + 1,
        status = CASE WHEN used_visits + 1 >= max_visits THEN 'used' ELSE 'active' END
    WHERE id = _e.id;

  INSERT INTO public.followup_audit_log (hospital_id, actor_id, action, entity_type, entity_id, details)
  VALUES (_e.hospital_id, auth.uid(), 'followup_booked', 'entitlement', _e.id,
          jsonb_build_object('appointment_id', _appt.id, 'token_no', _token, 'date', _appointment_date, 'channel', _channel));

  RETURN jsonb_build_object('appointment_id', _appt.id, 'token_no', _token, 'visit_date', _appointment_date, 'doctor_name', _e.doctor_name);
END;
$$;

REVOKE ALL ON FUNCTION public.book_followup_visit(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_followup_visit(uuid, date, text, text) TO authenticated;

-- ============ expire stale entitlements ============
CREATE OR REPLACE FUNCTION public.expire_followup_entitlements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n int;
BEGIN
  UPDATE public.followup_entitlements
     SET status = 'expired'
   WHERE status = 'active' AND expiry_date < CURRENT_DATE;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_followup_entitlements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_followup_entitlements() TO authenticated, service_role;
