// Patient Registration Module Types

export interface Patient {
  id: string;
  hospital_id: string;
  registration_number: string;
  name: string;
  mobile: string;
  dob: string | null;
  gender: "Male" | "Female" | "Other";
  emergency_contact: string;
  blood_group: string;
  address: string;
  chronic_conditions: string;
  created_at: string;
  updated_at: string;
}

export type PatientInsert = Omit<Patient, "id" | "created_at" | "updated_at" | "hospital_id"> & {
  hospital_id?: string;
};

export type PatientUpdate = Partial<Omit<Patient, "id" | "created_at" | "updated_at" | "hospital_id">>;
