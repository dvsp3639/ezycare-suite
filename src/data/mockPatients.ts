export interface Patient {
  id: string;
  registrationNumber: string;
  name: string;
  mobile: string;
  dob: string;
  gender: "Male" | "Female" | "Other";
  emergencyContact: string;
  bloodGroup: string;
  address: string;
  chronicConditions: string;
}

export const mockPatients: Patient[] = [
  {
    id: "1",
    registrationNumber: "EZY-2026-0001",
    name: "Rahul Verma",
    mobile: "9876543210",
    dob: "1990-05-15",
    gender: "Male",
    emergencyContact: "9876543200",
    bloodGroup: "O+",
    address: "42, MG Road, Bengaluru, Karnataka",
    chronicConditions: "Diabetes",
  },
  {
    id: "2",
    registrationNumber: "EZY-2026-0002",
    name: "Anita Sharma",
    mobile: "9876543210",
    dob: "1985-08-22",
    gender: "Female",
    emergencyContact: "",
    bloodGroup: "A+",
    address: "15, Nehru Nagar, Mumbai, Maharashtra",
    chronicConditions: "",
  },
  {
    id: "3",
    registrationNumber: "EZY-2026-0003",
    name: "Suresh Kumar",
    mobile: "9123456789",
    dob: "1978-12-03",
    gender: "Male",
    emergencyContact: "9123456700",
    bloodGroup: "B+",
    address: "78, Gandhi Marg, Delhi",
    chronicConditions: "Hypertension, Asthma",
  },
];

export const mockDoctors = [
  { id: "d1", name: "Dr. Anil Mehta", specialization: "General Medicine" },
  { id: "d2", name: "Dr. Priya Singh", specialization: "Cardiology" },
  { id: "d3", name: "Dr. Ravi Patel", specialization: "Orthopedics" },
  { id: "d4", name: "Dr. Sneha Gupta", specialization: "Pediatrics" },
];

export const generateTimeSlots = () => {
  const slots: { time: string; available: boolean }[] = [];
  for (let h = 9; h <= 17; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, "0");
      const min = m.toString().padStart(2, "0");
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h > 12 ? h - 12 : h;
      slots.push({
        time: `${displayHour}:${min} ${period}`,
        available: Math.random() > 0.3,
      });
    }
  }
  return slots;
};

let regCounter = 4;
export const generateRegistrationNumber = () => {
  const num = (regCounter++).toString().padStart(4, "0");
  return `EZY-2026-${num}`;
};
