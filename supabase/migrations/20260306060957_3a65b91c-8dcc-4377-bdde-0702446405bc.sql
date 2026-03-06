
-- =====================================================
-- HOSPITAL MANAGEMENT SYSTEM - COMPLETE SCHEMA
-- =====================================================

-- Auto-set hospital_id trigger function
CREATE OR REPLACE FUNCTION public.auto_set_hospital_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.hospital_id IS NULL THEN
    NEW.hospital_id := get_user_hospital_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-update updated_at (reuse existing if available)
CREATE OR REPLACE FUNCTION public.auto_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==================== REGISTRATION COUNTERS ====================
CREATE TABLE public.registration_counters (
  hospital_id uuid PRIMARY KEY REFERENCES public.hospitals(id) ON DELETE CASCADE,
  counter integer NOT NULL DEFAULT 0
);
ALTER TABLE public.registration_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospital_access_registration_counters" ON public.registration_counters FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_registration_counters" ON public.registration_counters FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== PATIENTS ====================
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  registration_number text NOT NULL,
  name text NOT NULL,
  mobile text NOT NULL,
  dob date,
  gender text NOT NULL DEFAULT 'Male',
  emergency_contact text DEFAULT '',
  blood_group text DEFAULT '',
  address text DEFAULT '',
  chronic_conditions text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hospital_id, registration_number)
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_patients BEFORE INSERT ON public.patients FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE TRIGGER update_timestamp_patients BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE POLICY "hospital_access_patients" ON public.patients FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_patients" ON public.patients FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== DOCTOR SCHEDULES ====================
CREATE TABLE public.doctor_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  doctor_name text NOT NULL,
  specialization text DEFAULT '',
  available_from text DEFAULT '9:00 AM',
  available_to text DEFAULT '5:00 PM',
  consultation_duration integer DEFAULT 30,
  schedule_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_doctor_schedules BEFORE INSERT ON public.doctor_schedules FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE TRIGGER update_timestamp_doctor_schedules BEFORE UPDATE ON public.doctor_schedules FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE POLICY "hospital_access_doctor_schedules" ON public.doctor_schedules FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_doctor_schedules" ON public.doctor_schedules FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== TIME SLOTS ====================
CREATE TABLE public.time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.doctor_schedules(id) ON DELETE CASCADE,
  time text NOT NULL,
  max_patients integer DEFAULT 5,
  booked_patients integer DEFAULT 0,
  is_active boolean DEFAULT true
);
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_time_slots BEFORE INSERT ON public.time_slots FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_time_slots" ON public.time_slots FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_time_slots" ON public.time_slots FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== APPOINTMENTS (OP Queue) ====================
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  token_no integer NOT NULL,
  patient_id uuid REFERENCES public.patients(id),
  patient_name text NOT NULL,
  registration_number text NOT NULL,
  doctor_name text NOT NULL,
  time_slot text DEFAULT '',
  opd_type text NOT NULL DEFAULT 'Normal',
  status text NOT NULL DEFAULT 'Waiting',
  check_in_time text DEFAULT '',
  diagnosis text DEFAULT '',
  doctor_notes text DEFAULT '',
  follow_up_date date,
  appointment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_appointments BEFORE INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE TRIGGER update_timestamp_appointments BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE POLICY "hospital_access_appointments" ON public.appointments FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_appointments" ON public.appointments FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== VITALS ====================
CREATE TABLE public.vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  bp text DEFAULT '',
  temperature text DEFAULT '',
  weight text DEFAULT '',
  height text DEFAULT '',
  spo2 text DEFAULT '',
  pulse text DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_vitals BEFORE INSERT ON public.vitals FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_vitals" ON public.vitals FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_vitals" ON public.vitals FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== PRESCRIPTIONS ====================
CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  medicine text NOT NULL,
  dosage text DEFAULT '',
  frequency text DEFAULT '',
  duration text DEFAULT '',
  instructions text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_prescriptions BEFORE INSERT ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_prescriptions" ON public.prescriptions FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_prescriptions" ON public.prescriptions FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== LAB TEST CATALOG ====================
CREATE TABLE public.lab_test_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Blood',
  price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_test_catalog ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_lab_test_catalog BEFORE INSERT ON public.lab_test_catalog FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_lab_test_catalog" ON public.lab_test_catalog FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_lab_test_catalog" ON public.lab_test_catalog FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== LAB TEST PARAMETERS ====================
CREATE TABLE public.lab_test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.lab_test_catalog(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text DEFAULT '',
  normal_range text DEFAULT ''
);
ALTER TABLE public.lab_test_parameters ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_lab_test_parameters BEFORE INSERT ON public.lab_test_parameters FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_lab_test_parameters" ON public.lab_test_parameters FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_lab_test_parameters" ON public.lab_test_parameters FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== LAB ORDERS ====================
CREATE TABLE public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id),
  test_name text NOT NULL,
  category text NOT NULL DEFAULT 'Blood',
  priority text NOT NULL DEFAULT 'Routine',
  status text NOT NULL DEFAULT 'Ordered',
  price numeric(10,2) NOT NULL DEFAULT 0,
  payment_status text DEFAULT 'Pending',
  payment_mode text,
  clinical_notes text DEFAULT '',
  ordered_by text NOT NULL,
  patient_name text NOT NULL,
  patient_reg_no text NOT NULL,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  sample_collected_at timestamptz,
  completed_at timestamptz,
  report_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_lab_orders BEFORE INSERT ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_lab_orders" ON public.lab_orders FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_lab_orders" ON public.lab_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== LAB RESULTS ====================
CREATE TABLE public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  lab_order_id uuid NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  parameter text NOT NULL,
  value text DEFAULT '',
  unit text DEFAULT '',
  normal_range text DEFAULT '',
  is_abnormal boolean DEFAULT false
);
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_lab_results BEFORE INSERT ON public.lab_results FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_lab_results" ON public.lab_results FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_lab_results" ON public.lab_results FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== MEDICINES ====================
CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  generic_name text DEFAULT '',
  category text DEFAULT '',
  manufacturer text DEFAULT '',
  batch_no text DEFAULT '',
  expiry_date date,
  mrp numeric(10,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  unit text DEFAULT 'Strip (10)',
  hsn_code text DEFAULT '',
  gst_percent numeric(5,2) DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_medicines BEFORE INSERT ON public.medicines FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE TRIGGER update_timestamp_medicines BEFORE UPDATE ON public.medicines FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE POLICY "hospital_access_medicines" ON public.medicines FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_medicines" ON public.medicines FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== PHARMACY ORDERS ====================
CREATE TABLE public.pharmacy_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  issue_type text NOT NULL DEFAULT 'OP Sale',
  patient_name text NOT NULL,
  registration_number text DEFAULT '',
  mobile text DEFAULT '',
  age integer,
  gender text DEFAULT '',
  doctor_name text DEFAULT '',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric(10,2) DEFAULT 0,
  discount numeric(10,2) DEFAULT 0,
  gst_amount numeric(10,2) DEFAULT 0,
  net_amount numeric(10,2) DEFAULT 0,
  payment_mode text DEFAULT '',
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pharmacy_orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_pharmacy_orders BEFORE INSERT ON public.pharmacy_orders FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_pharmacy_orders" ON public.pharmacy_orders FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_pharmacy_orders" ON public.pharmacy_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== PHARMACY ORDER ITEMS ====================
CREATE TABLE public.pharmacy_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.pharmacy_orders(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES public.medicines(id),
  medicine_name text NOT NULL,
  batch_no text DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  mrp numeric(10,2) DEFAULT 0,
  discount numeric(10,2) DEFAULT 0,
  gst_percent numeric(5,2) DEFAULT 12,
  amount numeric(10,2) DEFAULT 0
);
ALTER TABLE public.pharmacy_order_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_pharmacy_order_items BEFORE INSERT ON public.pharmacy_order_items FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_pharmacy_order_items" ON public.pharmacy_order_items FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_pharmacy_order_items" ON public.pharmacy_order_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== INVENTORY ITEMS ====================
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Consumables',
  sku text DEFAULT '',
  batch_no text DEFAULT '',
  manufacturer text DEFAULT '',
  unit_price numeric(10,2) DEFAULT 0,
  selling_price numeric(10,2) DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer DEFAULT 0,
  unit text DEFAULT 'Piece',
  hsn_code text DEFAULT '',
  gst_percent numeric(5,2) DEFAULT 12,
  expiry_date date,
  department text DEFAULT 'Store',
  barcode text DEFAULT '',
  vendor text DEFAULT '',
  purchase_date date,
  consumption_rate numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_inventory_items BEFORE INSERT ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE TRIGGER update_timestamp_inventory_items BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE POLICY "hospital_access_inventory_items" ON public.inventory_items FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_inventory_items" ON public.inventory_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== STOCK TRANSFERS ====================
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id),
  item_name text NOT NULL,
  from_dept text NOT NULL,
  to_dept text NOT NULL,
  quantity integer NOT NULL,
  transfer_date timestamptz NOT NULL DEFAULT now(),
  transferred_by text DEFAULT '',
  status text NOT NULL DEFAULT 'Pending',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_stock_transfers BEFORE INSERT ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_stock_transfers" ON public.stock_transfers FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_stock_transfers" ON public.stock_transfers FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== VENDORS ====================
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact text DEFAULT '',
  email text DEFAULT '',
  gst_no text DEFAULT '',
  categories text[] DEFAULT '{}',
  rating numeric(3,1) DEFAULT 0,
  avg_delivery_days integer DEFAULT 0,
  last_order_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_vendors BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_vendors" ON public.vendors FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_vendors" ON public.vendors FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== WARDS ====================
CREATE TABLE public.wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'General',
  floor text DEFAULT '',
  total_beds integer DEFAULT 0,
  charge_per_day numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_wards BEFORE INSERT ON public.wards FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_wards" ON public.wards FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_wards" ON public.wards FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== BEDS ====================
CREATE TABLE public.beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  ward_id uuid NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
  bed_number text NOT NULL,
  status text NOT NULL DEFAULT 'Available',
  patient_id uuid REFERENCES public.patients(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_beds BEFORE INSERT ON public.beds FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_beds" ON public.beds FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_beds" ON public.beds FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== IPD ADMISSIONS ====================
CREATE TABLE public.ipd_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id),
  patient_name text NOT NULL,
  registration_number text NOT NULL,
  age integer,
  gender text DEFAULT '',
  contact_number text DEFAULT '',
  referred_by text DEFAULT '',
  admitting_doctor text NOT NULL,
  department text DEFAULT '',
  diagnosis text DEFAULT '',
  ward_id uuid REFERENCES public.wards(id),
  ward_name text DEFAULT '',
  bed_id uuid REFERENCES public.beds(id),
  bed_number text DEFAULT '',
  admission_date timestamptz NOT NULL DEFAULT now(),
  discharge_date timestamptz,
  status text NOT NULL DEFAULT 'Active',
  emergency_contact text DEFAULT '',
  insurance_info text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ipd_admissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_ipd_admissions BEFORE INSERT ON public.ipd_admissions FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE TRIGGER update_timestamp_ipd_admissions BEFORE UPDATE ON public.ipd_admissions FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE POLICY "hospital_access_ipd_admissions" ON public.ipd_admissions FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_ipd_admissions" ON public.ipd_admissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Add admission_id to beds
ALTER TABLE public.beds ADD COLUMN admission_id uuid REFERENCES public.ipd_admissions(id);

-- ==================== DOCTOR VISIT NOTES (IPD) ====================
CREATE TABLE public.doctor_visit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  admission_id uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  visit_time text DEFAULT '',
  doctor text NOT NULL,
  notes text DEFAULT '',
  instructions text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_visit_notes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_doctor_visit_notes BEFORE INSERT ON public.doctor_visit_notes FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_doctor_visit_notes" ON public.doctor_visit_notes FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_doctor_visit_notes" ON public.doctor_visit_notes FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== NURSE NOTES (IPD) ====================
CREATE TABLE public.nurse_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  admission_id uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  note_time text DEFAULT '',
  nurse text NOT NULL,
  bp text DEFAULT '',
  temp text DEFAULT '',
  pulse text DEFAULT '',
  spo2 text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nurse_notes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_nurse_notes BEFORE INSERT ON public.nurse_notes FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_nurse_notes" ON public.nurse_notes FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_nurse_notes" ON public.nurse_notes FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== MEDICINE ENTRIES (IPD) ====================
CREATE TABLE public.medicine_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  admission_id uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  medicine_name text NOT NULL,
  dosage text DEFAULT '',
  frequency text DEFAULT '',
  quantity integer DEFAULT 1,
  unit_price numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicine_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_medicine_entries BEFORE INSERT ON public.medicine_entries FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_medicine_entries" ON public.medicine_entries FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_medicine_entries" ON public.medicine_entries FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== SURGICAL ENTRIES (IPD) ====================
CREATE TABLE public.surgical_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  admission_id uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  procedure_name text NOT NULL,
  surgeon text DEFAULT '',
  notes text DEFAULT '',
  cost numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.surgical_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_surgical_entries BEFORE INSERT ON public.surgical_entries FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_surgical_entries" ON public.surgical_entries FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_surgical_entries" ON public.surgical_entries FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== DIAGNOSTIC ENTRIES (IPD) ====================
CREATE TABLE public.diagnostic_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  admission_id uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  test_name text NOT NULL,
  result text DEFAULT '',
  cost numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.diagnostic_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_diagnostic_entries BEFORE INSERT ON public.diagnostic_entries FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_diagnostic_entries" ON public.diagnostic_entries FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_diagnostic_entries" ON public.diagnostic_entries FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== DISCHARGE SUMMARIES ====================
CREATE TABLE public.discharge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  admission_id uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  discharge_date timestamptz NOT NULL DEFAULT now(),
  condition_at_discharge text DEFAULT '',
  final_diagnosis text DEFAULT '',
  treatment_summary text DEFAULT '',
  follow_up_date date,
  follow_up_instructions text DEFAULT '',
  medications_on_discharge text DEFAULT '',
  total_bill numeric(10,2) DEFAULT 0,
  paid_amount numeric(10,2) DEFAULT 0,
  payment_status text DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discharge_summaries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_discharge_summaries BEFORE INSERT ON public.discharge_summaries FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_discharge_summaries" ON public.discharge_summaries FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_discharge_summaries" ON public.discharge_summaries FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== BED TRANSFERS ====================
CREATE TABLE public.bed_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  admission_id uuid NOT NULL REFERENCES public.ipd_admissions(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  from_ward text NOT NULL,
  from_bed text NOT NULL,
  to_ward text NOT NULL,
  to_bed text NOT NULL,
  reason text DEFAULT '',
  transfer_date timestamptz NOT NULL DEFAULT now(),
  transferred_by text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bed_transfers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_bed_transfers BEFORE INSERT ON public.bed_transfers FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_bed_transfers" ON public.bed_transfers FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_bed_transfers" ON public.bed_transfers FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== DAY CARE TREATMENTS (Catalog) ====================
CREATE TABLE public.daycare_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  duration text DEFAULT '',
  price numeric(10,2) DEFAULT 0,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daycare_treatments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_daycare_treatments BEFORE INSERT ON public.daycare_treatments FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_daycare_treatments" ON public.daycare_treatments FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_daycare_treatments" ON public.daycare_treatments FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== DAY CARE SESSIONS ====================
CREATE TABLE public.daycare_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id),
  patient_name text NOT NULL,
  registration_number text NOT NULL,
  age integer,
  gender text DEFAULT '',
  mobile text DEFAULT '',
  doctor_name text NOT NULL,
  admission_time text DEFAULT '',
  status text NOT NULL DEFAULT 'In Progress',
  diagnosis text DEFAULT '',
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daycare_sessions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_daycare_sessions BEFORE INSERT ON public.daycare_sessions FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE TRIGGER update_timestamp_daycare_sessions BEFORE UPDATE ON public.daycare_sessions FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE POLICY "hospital_access_daycare_sessions" ON public.daycare_sessions FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_daycare_sessions" ON public.daycare_sessions FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== DAY CARE SESSION TREATMENTS ====================
CREATE TABLE public.daycare_session_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.daycare_sessions(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.daycare_treatments(id),
  treatment_name text NOT NULL,
  status text NOT NULL DEFAULT 'Scheduled',
  start_time text,
  end_time text,
  notes text DEFAULT ''
);
ALTER TABLE public.daycare_session_treatments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_daycare_session_treatments BEFORE INSERT ON public.daycare_session_treatments FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_daycare_session_treatments" ON public.daycare_session_treatments FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_daycare_session_treatments" ON public.daycare_session_treatments FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== DAY CARE BILLING ====================
CREATE TABLE public.daycare_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.daycare_sessions(id) ON DELETE CASCADE,
  subtotal numeric(10,2) DEFAULT 0,
  discount numeric(10,2) DEFAULT 0,
  tax numeric(10,2) DEFAULT 0,
  grand_total numeric(10,2) DEFAULT 0,
  payment_status text DEFAULT 'Pending',
  payment_mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daycare_bills ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_daycare_bills BEFORE INSERT ON public.daycare_bills FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_daycare_bills" ON public.daycare_bills FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_daycare_bills" ON public.daycare_bills FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== DAY CARE BILL ITEMS ====================
CREATE TABLE public.daycare_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES public.daycare_bills(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text DEFAULT 'Other',
  qty integer DEFAULT 1,
  unit_price numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0
);
ALTER TABLE public.daycare_bill_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_daycare_bill_items BEFORE INSERT ON public.daycare_bill_items FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_daycare_bill_items" ON public.daycare_bill_items FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_daycare_bill_items" ON public.daycare_bill_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== STAFF MEMBERS ====================
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Staff',
  department text DEFAULT '',
  designation text DEFAULT '',
  employment_type text DEFAULT 'Full-Time',
  joining_date date,
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  emergency_contact text DEFAULT '',
  blood_group text DEFAULT '',
  qualification text DEFAULT '',
  specialization text DEFAULT '',
  aadhar_no text DEFAULT '',
  pan_no text DEFAULT '',
  bank_account text DEFAULT '',
  bank_name text DEFAULT '',
  ifsc_code text DEFAULT '',
  base_salary numeric(10,2) DEFAULT 0,
  status text DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_staff_members BEFORE INSERT ON public.staff_members FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE TRIGGER update_timestamp_staff_members BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION auto_update_timestamp();
CREATE POLICY "hospital_access_staff_members" ON public.staff_members FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_staff_members" ON public.staff_members FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== SALARY RECORDS ====================
CREATE TABLE public.salary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  month text NOT NULL,
  base_salary numeric(10,2) DEFAULT 0,
  hra numeric(10,2) DEFAULT 0,
  da numeric(10,2) DEFAULT 0,
  special_allowance numeric(10,2) DEFAULT 0,
  overtime numeric(10,2) DEFAULT 0,
  deductions numeric(10,2) DEFAULT 0,
  pf numeric(10,2) DEFAULT 0,
  esi numeric(10,2) DEFAULT 0,
  tax numeric(10,2) DEFAULT 0,
  advance numeric(10,2) DEFAULT 0,
  net_salary numeric(10,2) DEFAULT 0,
  status text DEFAULT 'Pending',
  paid_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_salary_records BEFORE INSERT ON public.salary_records FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_salary_records" ON public.salary_records FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_salary_records" ON public.salary_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== SALARY ADVANCES ====================
CREATE TABLE public.salary_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text DEFAULT '',
  status text DEFAULT 'Pending',
  approved_by text,
  repayment_months integer,
  monthly_deduction numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_salary_advances BEFORE INSERT ON public.salary_advances FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_salary_advances" ON public.salary_advances FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_salary_advances" ON public.salary_advances FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== ATTENDANCE RECORDS ====================
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  check_in text,
  check_out text,
  status text NOT NULL DEFAULT 'Present',
  hours_worked numeric(5,2),
  overtime_hours numeric(5,2),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_attendance_records BEFORE INSERT ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_attendance_records" ON public.attendance_records FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_attendance_records" ON public.attendance_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== LEAVE REQUESTS ====================
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  leave_type text NOT NULL DEFAULT 'Casual',
  from_date date NOT NULL,
  to_date date NOT NULL,
  days integer NOT NULL DEFAULT 1,
  reason text DEFAULT '',
  status text DEFAULT 'Pending',
  applied_date date NOT NULL DEFAULT CURRENT_DATE,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_hospital_id_leave_requests BEFORE INSERT ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION auto_set_hospital_id();
CREATE POLICY "hospital_access_leave_requests" ON public.leave_requests FOR ALL TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid())) WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "super_admin_leave_requests" ON public.leave_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ==================== NEXT REG NUMBER FUNCTION ====================
CREATE OR REPLACE FUNCTION public.next_registration_number(_hospital_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _counter integer;
BEGIN
  INSERT INTO public.registration_counters (hospital_id, counter)
  VALUES (_hospital_id, 1)
  ON CONFLICT (hospital_id)
  DO UPDATE SET counter = registration_counters.counter + 1
  RETURNING counter INTO _counter;
  
  RETURN 'EZY-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(_counter::text, 4, '0');
END;
$$;
