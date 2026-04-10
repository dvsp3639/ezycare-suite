
-- Create ranges table for multi-range parameters
CREATE TABLE public.lab_test_parameter_ranges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parameter_id uuid NOT NULL REFERENCES public.lab_test_parameters(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  sex text NOT NULL DEFAULT 'any',
  min_age integer NULL,
  max_age text NULL,
  normal_range text NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lab_test_parameter_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospital_access_lab_test_parameter_ranges"
  ON public.lab_test_parameter_ranges FOR ALL TO authenticated
  USING (hospital_id = get_user_hospital_id(auth.uid()))
  WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "super_admin_lab_test_parameter_ranges"
  ON public.lab_test_parameter_ranges FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Auto-set hospital_id trigger
CREATE TRIGGER auto_set_hospital_id_lab_test_parameter_ranges
  BEFORE INSERT ON public.lab_test_parameter_ranges
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_hospital_id();

-- Migrate existing data: move sex/min_age/max_age/normal_range from parameters into ranges
INSERT INTO public.lab_test_parameter_ranges (parameter_id, hospital_id, sex, min_age, max_age, normal_range)
SELECT id, hospital_id, sex, min_age, max_age, COALESCE(normal_range, '')
FROM public.lab_test_parameters;

-- Now remove the range-specific columns from lab_test_parameters (they live in ranges now)
ALTER TABLE public.lab_test_parameters DROP COLUMN sex;
ALTER TABLE public.lab_test_parameters DROP COLUMN min_age;
ALTER TABLE public.lab_test_parameters DROP COLUMN max_age;
ALTER TABLE public.lab_test_parameters DROP COLUMN normal_range;
