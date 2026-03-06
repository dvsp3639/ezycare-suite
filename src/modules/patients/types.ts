// Patient Registration Module Types

export interface Patient {
  id: string;
  hospitalId: string;
  registrationNumber: string;
  name: string;
  mobile: string;
  dob: string | null;
  gender: "Male" | "Female" | "Other";
  emergencyContact: string;
  bloodGroup: string;
  address: string;
  chronicConditions: string;
  createdAt: string;
  updatedAt: string;
}

export type PatientInsert = Omit<Patient, "id" | "createdAt" | "updatedAt" | "hospitalId"> & {
  hospitalId?: string;
};

export type PatientUpdate = Partial<Omit<Patient, "id" | "createdAt" | "updatedAt" | "hospitalId">>;
