CREATE TABLE public.appointment_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_name text NOT NULL DEFAULT '',
  registration_number text NOT NULL DEFAULT '',
  doctor_name text NOT NULL DEFAULT '',
  old_date date NOT NULL,
  old_time_slot text NOT NULL DEFAULT '',
  old_token_no integer,
  new_date date NOT NULL,
  new_time_slot text NOT NULL DEFAULT '',
  new_token_no integer,
  reason text NOT NULL DEFAULT '',
  rescheduled_by uuid,
  rescheduled_by_name text NOT NULL DEFAULT '',
  notify_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.appointment_reschedules TO authenticated;
GRANT ALL ON public.appointment_reschedules TO service_role;

ALTER TABLE public.appointment_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital users can view their reschedule history"
ON public.appointment_reschedules FOR SELECT TO authenticated
USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Hospital users can insert reschedule history"
ON public.appointment_reschedules FOR INSERT TO authenticated
WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE INDEX idx_appointment_reschedules_appt ON public.appointment_reschedules(appointment_id);
CREATE INDEX idx_appointment_reschedules_hospital ON public.appointment_reschedules(hospital_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  _appointment_id uuid,
  _new_date date,
  _new_time_slot text,
  _reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _a public.appointments%ROWTYPE;
  _hid uuid := public.get_user_hospital_id(auth.uid());
  _old_slot_id uuid;
  _new_slot_id uuid;
  _new_token int;
  _actor_name text := '';
BEGIN
  IF _hid IS NULL THEN RAISE EXCEPTION 'No hospital access for current user'; END IF;

  SELECT * INTO _a FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF _a.hospital_id <> _hid THEN RAISE EXCEPTION 'Not allowed for this hospital'; END IF;
  IF _a.status IN ('Completed', 'Cancelled') THEN
    RAISE EXCEPTION 'Only active appointments can be rescheduled (current status: %)', _a.status;
  END IF;
  IF _new_time_slot IS NULL OR _new_time_slot = '' THEN
    RAISE EXCEPTION 'A new time slot must be selected';
  END IF;

  -- release the previous slot
  SELECT ts.id INTO _old_slot_id
  FROM public.time_slots ts
  JOIN public.doctor_schedules ds ON ds.id = ts.schedule_id
  WHERE ds.hospital_id = _hid
    AND ds.schedule_date = _a.appointment_date
    AND lower(ds.doctor_name) = lower(_a.doctor_name)
    AND ts.time = _a.time_slot
  LIMIT 1;

  IF _old_slot_id IS NOT NULL THEN
    UPDATE public.time_slots
      SET booked_patients = GREATEST(0, COALESCE(booked_patients, 0) - 1)
      WHERE id = _old_slot_id;
  END IF;

  -- claim the new slot
  SELECT ts.id INTO _new_slot_id
  FROM public.time_slots ts
  JOIN public.doctor_schedules ds ON ds.id = ts.schedule_id
  WHERE ds.hospital_id = _hid
    AND ds.schedule_date = _new_date
    AND lower(ds.doctor_name) = lower(_a.doctor_name)
    AND ts.time = _new_time_slot
  LIMIT 1
  FOR UPDATE OF ts;

  IF _new_slot_id IS NULL THEN
    RAISE EXCEPTION 'Selected slot is no longer available for this doctor';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.time_slots
    WHERE id = _new_slot_id
      AND (is_active = false OR COALESCE(booked_patients,0) >= COALESCE(max_patients,0))
  ) THEN
    -- restore old slot count before failing
    IF _old_slot_id IS NOT NULL THEN
      UPDATE public.time_slots SET booked_patients = COALESCE(booked_patients,0) + 1 WHERE id = _old_slot_id;
    END IF;
    RAISE EXCEPTION 'Selected slot is already full';
  END IF;

  UPDATE public.time_slots
    SET booked_patients = COALESCE(booked_patients, 0) + 1
    WHERE id = _new_slot_id;

  SELECT COALESCE(MAX(token_no), 0) + 1 INTO _new_token
  FROM public.appointments
  WHERE hospital_id = _hid
    AND appointment_date = _new_date
    AND lower(doctor_name) = lower(_a.doctor_name)
    AND id <> _a.id;

  SELECT COALESCE(full_name, '') INTO _actor_name FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.appointment_reschedules (
    hospital_id, appointment_id, patient_name, registration_number, doctor_name,
    old_date, old_time_slot, old_token_no, new_date, new_time_slot, new_token_no,
    reason, rescheduled_by, rescheduled_by_name
  ) VALUES (
    _hid, _a.id, _a.patient_name, COALESCE(_a.registration_number,''), _a.doctor_name,
    _a.appointment_date, COALESCE(_a.time_slot,''), _a.token_no, _new_date, _new_time_slot, _new_token,
    COALESCE(_reason,''), auth.uid(), COALESCE(_actor_name,'')
  );

  UPDATE public.appointments
    SET appointment_date = _new_date,
        time_slot = _new_time_slot,
        token_no = _new_token,
        status = 'Waiting',
        updated_at = now()
    WHERE id = _a.id;

  RETURN jsonb_build_object(
    'appointment_id', _a.id,
    'new_date', _new_date,
    'new_time_slot', _new_time_slot,
    'new_token_no', _new_token,
    'old_token_no', _a.token_no
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, date, text, text) TO authenticated;