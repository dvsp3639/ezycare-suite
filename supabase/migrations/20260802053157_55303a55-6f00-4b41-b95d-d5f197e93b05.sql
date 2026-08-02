DROP FUNCTION IF EXISTS public.generate_doctor_slots(text, date, date);
DROP TABLE IF EXISTS public.doctor_op_sessions CASCADE;
DROP TABLE IF EXISTS public.doctor_weekly_schedules CASCADE;
DROP TABLE IF EXISTS public.doctor_daily_overrides CASCADE;
DROP TABLE IF EXISTS public.doctor_leaves CASCADE;
DROP TABLE IF EXISTS public.hospital_holidays CASCADE;
DROP TABLE IF EXISTS public.doctor_live_status CASCADE;