CREATE OR REPLACE FUNCTION public.get_user_hospital_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _count int;
  _hospital uuid;
BEGIN
  SELECT count(*) INTO _count
  FROM (
    SELECT DISTINCT hospital_id
    FROM public.user_roles
    WHERE user_id = _user_id AND hospital_id IS NOT NULL
  ) s;

  IF _count > 1 THEN
    RAISE EXCEPTION 'User % has roles in multiple hospitals; active hospital must be set explicitly', _user_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT hospital_id INTO _hospital
  FROM public.user_roles
  WHERE user_id = _user_id AND hospital_id IS NOT NULL
  ORDER BY hospital_id::text
  LIMIT 1;

  RETURN _hospital;
END;
$function$;