ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.patients ALTER COLUMN dob DROP NOT NULL;

ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS consultation_fee numeric NOT NULL DEFAULT 0;

-- Backfill age from dob where available
UPDATE public.patients
   SET age = date_part('year', age(dob))::int
 WHERE age IS NULL AND dob IS NOT NULL;

-- Deduplicate doctor schedules: keep the row with the most time slots
WITH ranked AS (
  SELECT ds.id,
         row_number() OVER (
           PARTITION BY ds.hospital_id, lower(ds.doctor_name), ds.schedule_date
           ORDER BY (SELECT count(*) FROM public.time_slots ts WHERE ts.schedule_id = ds.id) DESC,
                    ds.created_at ASC
         ) AS rn
    FROM public.doctor_schedules ds
)
DELETE FROM public.doctor_schedules d
 USING ranked r
 WHERE d.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS doctor_schedules_unique_per_day
  ON public.doctor_schedules (hospital_id, lower(doctor_name), schedule_date);