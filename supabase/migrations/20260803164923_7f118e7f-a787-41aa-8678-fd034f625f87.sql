ALTER TABLE public.followup_policies ALTER COLUMN window_days SET DEFAULT 15;

CREATE OR REPLACE FUNCTION public.get_patient_followup_status(_patient_id uuid DEFAULT NULL, _registration_number text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hid uuid := public.get_user_hospital_id(auth.uid());
  _e public.followup_entitlements%ROWTYPE;
  _window int;
  _last record;
  _expiry date;
BEGIN
  IF _hid IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_hospital');
  END IF;

  SELECT * INTO _e
  FROM public.followup_entitlements
  WHERE hospital_id = _hid
    AND ((_patient_id IS NOT NULL AND patient_id = _patient_id)
      OR (_registration_number IS NOT NULL AND registration_number = _registration_number))
    AND status = 'active'
    AND used_visits < max_visits
    AND expiry_date >= CURRENT_DATE
  ORDER BY expiry_date DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'source', 'entitlement',
      'entitlement_id', _e.id,
      'expiry_date', _e.expiry_date,
      'days_left', (_e.expiry_date - CURRENT_DATE),
      'doctor_name', _e.doctor_name,
      'visits_left', (_e.max_visits - _e.used_visits),
      'source_visit_date', _e.source_visit_date
    );
  END IF;

  SELECT COALESCE(window_days, 15) INTO _window
  FROM public.followup_policies WHERE hospital_id = _hid;
  _window := COALESCE(_window, 15);

  SELECT a.appointment_date, a.doctor_name INTO _last
  FROM public.appointments a
  WHERE a.hospital_id = _hid
    AND ((_patient_id IS NOT NULL AND a.patient_id = _patient_id)
      OR (_registration_number IS NOT NULL AND a.registration_number = _registration_number))
    AND a.status = 'Completed'
  ORDER BY a.appointment_date DESC
  LIMIT 1;

  IF _last.appointment_date IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_previous_visit', 'window_days', _window);
  END IF;

  _expiry := _last.appointment_date + _window;
  IF _expiry < CURRENT_DATE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'expired', 'expiry_date', _expiry,
      'window_days', _window, 'doctor_name', _last.doctor_name, 'source_visit_date', _last.appointment_date);
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'source', 'policy_default',
    'expiry_date', _expiry,
    'days_left', (_expiry - CURRENT_DATE),
    'doctor_name', _last.doctor_name,
    'visits_left', 1,
    'window_days', _window,
    'source_visit_date', _last.appointment_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_followup_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_followup_status(uuid, text) TO authenticated;