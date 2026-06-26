
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS salt_name text,
  ADD COLUMN IF NOT EXISTS strength text,
  ADD COLUMN IF NOT EXISTS dosage_form text,
  ADD COLUMN IF NOT EXISTS rack_location text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS selling_price numeric,
  ADD COLUMN IF NOT EXISTS min_stock integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS medicines_search_trgm
  ON public.medicines USING gin (
    (coalesce(name,'') || ' ' || coalesce(generic_name,'') || ' ' || coalesce(brand_name,'') || ' ' || coalesce(salt_name,'') || ' ' || coalesce(strength,'')) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS medicines_barcode_idx ON public.medicines(barcode) WHERE barcode IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.medicine_search_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  user_id uuid NOT NULL,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  query text,
  picks integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, user_id, medicine_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicine_search_usage TO authenticated;
GRANT ALL ON public.medicine_search_usage TO service_role;

ALTER TABLE public.medicine_search_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own hospital usage"
  ON public.medicine_search_usage FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Users write own usage"
  ON public.medicine_search_usage FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Users update own usage"
  ON public.medicine_search_usage FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND hospital_id = public.get_user_hospital_id(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE INDEX IF NOT EXISTS medicine_usage_lookup
  ON public.medicine_search_usage(hospital_id, user_id, medicine_id);

CREATE OR REPLACE FUNCTION public.record_medicine_pick(_medicine_id uuid, _query text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hospital_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  _hospital_id := public.get_user_hospital_id(_user_id);
  IF _hospital_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.medicine_search_usage (hospital_id, user_id, medicine_id, query, picks, last_used_at)
  VALUES (_hospital_id, _user_id, _medicine_id, _query, 1, now())
  ON CONFLICT (hospital_id, user_id, medicine_id)
  DO UPDATE SET picks = medicine_search_usage.picks + 1,
                last_used_at = now(),
                query = COALESCE(EXCLUDED.query, medicine_search_usage.query);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_medicine_pick(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_medicine_pick(uuid, text) TO authenticated;
