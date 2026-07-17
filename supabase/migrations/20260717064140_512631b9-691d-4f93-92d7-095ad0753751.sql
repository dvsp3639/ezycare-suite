
-- Doctor Availability Engine tables

-- 1. Weekly schedule template
CREATE TABLE public.doctor_weekly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  doctor_name TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working BOOLEAN NOT NULL DEFAULT true,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, doctor_name, day_of_week)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_weekly_schedules TO authenticated;
GRANT ALL ON public.doctor_weekly_schedules TO service_role;
ALTER TABLE public.doctor_weekly_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp scope weekly" ON public.doctor_weekly_schedules
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE TRIGGER trg_weekly_hosp BEFORE INSERT ON public.doctor_weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
CREATE TRIGGER trg_weekly_upd BEFORE UPDATE ON public.doctor_weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_timestamp();

-- 2. OP sessions per weekly day
CREATE TABLE public.doctor_op_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  weekly_schedule_id UUID NOT NULL REFERENCES public.doctor_weekly_schedules(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL DEFAULT 'Morning OP',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  slot_duration_min INT NOT NULL DEFAULT 15,
  buffer_min INT NOT NULL DEFAULT 0,
  token_capacity INT NOT NULL DEFAULT 20,
  max_online INT NOT NULL DEFAULT 10,
  max_walkin INT NOT NULL DEFAULT 10,
  consultation_fee NUMERIC NOT NULL DEFAULT 0,
  booking_window_days INT NOT NULL DEFAULT 7,
  online_enabled BOOLEAN NOT NULL DEFAULT true,
  walkin_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_op_sessions TO authenticated;
GRANT ALL ON public.doctor_op_sessions TO service_role;
ALTER TABLE public.doctor_op_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp scope sessions" ON public.doctor_op_sessions
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE TRIGGER trg_sessions_hosp BEFORE INSERT ON public.doctor_op_sessions
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
CREATE TRIGGER trg_sessions_upd BEFORE UPDATE ON public.doctor_op_sessions
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_timestamp();

-- 3. Daily overrides
CREATE TABLE public.doctor_daily_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  doctor_name TEXT NOT NULL,
  override_date DATE NOT NULL,
  override_type TEXT NOT NULL DEFAULT 'custom',
  sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, doctor_name, override_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_daily_overrides TO authenticated;
GRANT ALL ON public.doctor_daily_overrides TO service_role;
ALTER TABLE public.doctor_daily_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp scope override" ON public.doctor_daily_overrides
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE TRIGGER trg_override_hosp BEFORE INSERT ON public.doctor_daily_overrides
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
CREATE TRIGGER trg_override_upd BEFORE UPDATE ON public.doctor_daily_overrides
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_timestamp();

-- 4. Doctor leaves
CREATE TABLE public.doctor_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  doctor_name TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'single',
  half_day_period TEXT DEFAULT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_leaves TO authenticated;
GRANT ALL ON public.doctor_leaves TO service_role;
ALTER TABLE public.doctor_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp scope leaves" ON public.doctor_leaves
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE TRIGGER trg_leaves_hosp BEFORE INSERT ON public.doctor_leaves
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
CREATE TRIGGER trg_leaves_upd BEFORE UPDATE ON public.doctor_leaves
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_timestamp();

-- 5. Hospital holidays
CREATE TABLE public.hospital_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  is_recurring_yearly BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, holiday_date, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_holidays TO authenticated;
GRANT ALL ON public.hospital_holidays TO service_role;
ALTER TABLE public.hospital_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp scope holidays" ON public.hospital_holidays
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE TRIGGER trg_holidays_hosp BEFORE INSERT ON public.hospital_holidays
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
CREATE TRIGGER trg_holidays_upd BEFORE UPDATE ON public.hospital_holidays
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_timestamp();

-- 6. Live status
CREATE TABLE public.doctor_live_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  doctor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  delay_minutes INT DEFAULT 0,
  message TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, doctor_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_live_status TO authenticated;
GRANT ALL ON public.doctor_live_status TO service_role;
ALTER TABLE public.doctor_live_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp scope livestatus" ON public.doctor_live_status
  FOR ALL TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE TRIGGER trg_livestatus_hosp BEFORE INSERT ON public.doctor_live_status
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();
CREATE TRIGGER trg_livestatus_upd BEFORE UPDATE ON public.doctor_live_status
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_timestamp();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_live_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_weekly_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_op_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_daily_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_leaves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_holidays;

-- Slot generator: materialize doctor_schedules + time_slots for a doctor+date range
CREATE OR REPLACE FUNCTION public.generate_doctor_slots(_doctor_name TEXT, _from_date DATE, _to_date DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _hospital_id UUID;
  _user_id UUID := auth.uid();
  _d DATE;
  _dow SMALLINT;
  _weekly RECORD;
  _sess RECORD;
  _override RECORD;
  _on_leave BOOLEAN;
  _is_holiday BOOLEAN;
  _spec TEXT;
  _sched_id UUID;
  _slot_time TIMESTAMP;
  _end_time TIMESTAMP;
  _step INT;
  _generated INT := 0;
  _first_start TEXT;
  _last_end TEXT;
BEGIN
  _hospital_id := public.get_user_hospital_id(_user_id);
  IF _hospital_id IS NULL THEN
    RAISE EXCEPTION 'No hospital access';
  END IF;

  SELECT specialization INTO _spec FROM public.staff_members
    WHERE hospital_id = _hospital_id AND lower(name) = lower(_doctor_name) LIMIT 1;

  _d := _from_date;
  WHILE _d <= _to_date LOOP
    _dow := EXTRACT(DOW FROM _d)::SMALLINT;

    -- leave check
    SELECT EXISTS (
      SELECT 1 FROM public.doctor_leaves
      WHERE hospital_id = _hospital_id AND lower(doctor_name) = lower(_doctor_name)
        AND status = 'Approved' AND _d BETWEEN from_date AND to_date
    ) INTO _on_leave;

    -- holiday check
    SELECT EXISTS (
      SELECT 1 FROM public.hospital_holidays
      WHERE hospital_id = _hospital_id
        AND (holiday_date = _d OR (is_recurring_yearly AND EXTRACT(MONTH FROM holiday_date) = EXTRACT(MONTH FROM _d) AND EXTRACT(DAY FROM holiday_date) = EXTRACT(DAY FROM _d)))
    ) INTO _is_holiday;

    -- Delete existing generated schedule+slots for this doctor+date
    DELETE FROM public.time_slots WHERE schedule_id IN (
      SELECT id FROM public.doctor_schedules
      WHERE hospital_id = _hospital_id AND lower(doctor_name) = lower(_doctor_name) AND schedule_date = _d
    );
    DELETE FROM public.doctor_schedules
      WHERE hospital_id = _hospital_id AND lower(doctor_name) = lower(_doctor_name) AND schedule_date = _d;

    IF _on_leave OR _is_holiday THEN
      _d := _d + INTERVAL '1 day';
      CONTINUE;
    END IF;

    -- override takes precedence
    SELECT * INTO _override FROM public.doctor_daily_overrides
      WHERE hospital_id = _hospital_id AND lower(doctor_name) = lower(_doctor_name) AND override_date = _d
      LIMIT 1;

    IF FOUND AND _override.override_type = 'closed' THEN
      _d := _d + INTERVAL '1 day';
      CONTINUE;
    END IF;

    -- get weekly template for this DOW
    SELECT * INTO _weekly FROM public.doctor_weekly_schedules
      WHERE hospital_id = _hospital_id AND lower(doctor_name) = lower(_doctor_name) AND day_of_week = _dow
      LIMIT 1;

    IF (NOT FOUND OR NOT _weekly.is_working) AND (NOT FOUND OR _override.id IS NULL) THEN
      _d := _d + INTERVAL '1 day';
      CONTINUE;
    END IF;

    -- Gather sessions (from override if present, else from weekly)
    -- We compute overall from/to from earliest start to latest end
    _first_start := NULL;
    _last_end := NULL;

    -- Insert doctor_schedule row first (we'll compute available_from/to after sessions)
    INSERT INTO public.doctor_schedules (hospital_id, doctor_name, specialization, schedule_date, available_from, available_to, consultation_duration)
    VALUES (_hospital_id, _doctor_name, COALESCE(_spec, ''), _d, '9:00 AM', '5:00 PM', 15)
    RETURNING id INTO _sched_id;

    IF _override.id IS NOT NULL AND jsonb_array_length(COALESCE(_override.sessions, '[]'::jsonb)) > 0 THEN
      -- override sessions
      FOR _sess IN
        SELECT (elem->>'start_time') AS start_time,
               (elem->>'end_time') AS end_time,
               COALESCE((elem->>'slot_duration_min')::int, 15) AS slot_duration_min,
               COALESCE((elem->>'token_capacity')::int, 20) AS token_capacity
        FROM jsonb_array_elements(_override.sessions) elem
      LOOP
        _slot_time := (_d::text || ' ' || _sess.start_time)::timestamp;
        _end_time := (_d::text || ' ' || _sess.end_time)::timestamp;
        _step := _sess.slot_duration_min;
        IF _first_start IS NULL THEN _first_start := _sess.start_time; END IF;
        _last_end := _sess.end_time;
        WHILE _slot_time < _end_time LOOP
          INSERT INTO public.time_slots (hospital_id, schedule_id, time, max_patients, booked_patients, is_active)
          VALUES (_hospital_id, _sched_id, to_char(_slot_time, 'HH12:MI AM'),
                  GREATEST(1, _sess.token_capacity / GREATEST(1, ((extract(epoch from (_end_time - (_d::text || ' ' || _sess.start_time)::timestamp))/60)::int / _step))), 0, true);
          _generated := _generated + 1;
          _slot_time := _slot_time + make_interval(mins => _step);
        END LOOP;
      END LOOP;
    ELSE
      FOR _sess IN
        SELECT s.* FROM public.doctor_op_sessions s
        WHERE s.weekly_schedule_id = _weekly.id
        ORDER BY s.sort_order, s.start_time
      LOOP
        _slot_time := (_d::text || ' ' || _sess.start_time)::timestamp;
        _end_time := (_d::text || ' ' || _sess.end_time)::timestamp;
        _step := _sess.slot_duration_min + _sess.buffer_min;
        IF _first_start IS NULL THEN _first_start := _sess.start_time; END IF;
        _last_end := _sess.end_time;
        WHILE _slot_time < _end_time LOOP
          INSERT INTO public.time_slots (hospital_id, schedule_id, time, max_patients, booked_patients, is_active)
          VALUES (_hospital_id, _sched_id, to_char(_slot_time, 'HH12:MI AM'),
                  GREATEST(1, _sess.token_capacity / GREATEST(1, ((extract(epoch from (_end_time - (_d::text || ' ' || _sess.start_time)::timestamp))/60)::int / GREATEST(1,_step)))),
                  0, true);
          _generated := _generated + 1;
          _slot_time := _slot_time + make_interval(mins => _step);
        END LOOP;
      END LOOP;
    END IF;

    IF _first_start IS NOT NULL THEN
      UPDATE public.doctor_schedules
        SET available_from = to_char((_d::text || ' ' || _first_start)::timestamp, 'HH12:MI AM'),
            available_to   = to_char((_d::text || ' ' || _last_end)::timestamp, 'HH12:MI AM')
        WHERE id = _sched_id;
    ELSE
      DELETE FROM public.doctor_schedules WHERE id = _sched_id;
    END IF;

    _d := _d + INTERVAL '1 day';
  END LOOP;

  RETURN _generated;
END;
$fn$;
