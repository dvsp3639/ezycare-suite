CREATE POLICY "Hospital members can read own profile"
ON public.hospital_profiles FOR SELECT TO authenticated
USING (hospital_id = public.get_user_hospital_id(auth.uid()));