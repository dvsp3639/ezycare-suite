export interface DoctorSchedule {
  id: string;
  doctorName: string;
  specialization: string;
  timeSlots: {
    time: string;
    maxPatients: number;
    bookedPatients: number;
  }[];
}

export interface QueueEntry {
  id: string;
  tokenNo: number;
  patientName: string;
  registrationNumber: string;
  doctorName: string;
  timeSlot: string;
  opdType: "Normal" | "Emergency" | "Follow Up";
  status: "Waiting" | "In Consultation" | "Completed" | "No Show";
  checkInTime: string;
}

export interface ClinicPatient {
  id: string;
  registrationNumber: string;
  name: string;
  mobile: string;
  gender: "Male" | "Female" | "Other";
  age: number;
  lastVisit: string;
  totalVisits: number;
  doctor: string;
  diagnosis: string;
}

export const mockDoctorSchedules: DoctorSchedule[] = [
  {
    id: "d1",
    doctorName: "Dr. Anil Mehta",
    specialization: "General Medicine",
    timeSlots: [
      { time: "9:00 AM", maxPatients: 5, bookedPatients: 5 },
      { time: "9:30 AM", maxPatients: 5, bookedPatients: 3 },
      { time: "10:00 AM", maxPatients: 5, bookedPatients: 4 },
      { time: "10:30 AM", maxPatients: 5, bookedPatients: 2 },
      { time: "11:00 AM", maxPatients: 5, bookedPatients: 0 },
      { time: "11:30 AM", maxPatients: 5, bookedPatients: 1 },
      { time: "2:00 PM", maxPatients: 5, bookedPatients: 3 },
      { time: "2:30 PM", maxPatients: 5, bookedPatients: 0 },
      { time: "3:00 PM", maxPatients: 5, bookedPatients: 0 },
      { time: "3:30 PM", maxPatients: 5, bookedPatients: 2 },
    ],
  },
  {
    id: "d2",
    doctorName: "Dr. Priya Singh",
    specialization: "Cardiology",
    timeSlots: [
      { time: "9:00 AM", maxPatients: 3, bookedPatients: 3 },
      { time: "9:30 AM", maxPatients: 3, bookedPatients: 2 },
      { time: "10:00 AM", maxPatients: 3, bookedPatients: 1 },
      { time: "10:30 AM", maxPatients: 3, bookedPatients: 0 },
      { time: "11:00 AM", maxPatients: 3, bookedPatients: 3 },
      { time: "11:30 AM", maxPatients: 3, bookedPatients: 0 },
      { time: "2:00 PM", maxPatients: 3, bookedPatients: 1 },
      { time: "2:30 PM", maxPatients: 3, bookedPatients: 0 },
    ],
  },
  {
    id: "d3",
    doctorName: "Dr. Ravi Patel",
    specialization: "Orthopedics",
    timeSlots: [
      { time: "10:00 AM", maxPatients: 4, bookedPatients: 4 },
      { time: "10:30 AM", maxPatients: 4, bookedPatients: 3 },
      { time: "11:00 AM", maxPatients: 4, bookedPatients: 2 },
      { time: "11:30 AM", maxPatients: 4, bookedPatients: 1 },
      { time: "2:00 PM", maxPatients: 4, bookedPatients: 0 },
      { time: "2:30 PM", maxPatients: 4, bookedPatients: 0 },
      { time: "3:00 PM", maxPatients: 4, bookedPatients: 2 },
    ],
  },
  {
    id: "d4",
    doctorName: "Dr. Sneha Gupta",
    specialization: "Pediatrics",
    timeSlots: [
      { time: "9:00 AM", maxPatients: 6, bookedPatients: 4 },
      { time: "9:30 AM", maxPatients: 6, bookedPatients: 6 },
      { time: "10:00 AM", maxPatients: 6, bookedPatients: 2 },
      { time: "10:30 AM", maxPatients: 6, bookedPatients: 0 },
      { time: "11:00 AM", maxPatients: 6, bookedPatients: 5 },
      { time: "2:00 PM", maxPatients: 6, bookedPatients: 3 },
      { time: "2:30 PM", maxPatients: 6, bookedPatients: 1 },
      { time: "3:00 PM", maxPatients: 6, bookedPatients: 0 },
    ],
  },
];

export const mockQueue: QueueEntry[] = [
  { id: "q1", tokenNo: 1, patientName: "Rahul Verma", registrationNumber: "EZY-2026-0001", doctorName: "Dr. Anil Mehta", timeSlot: "9:00 AM", opdType: "Normal", status: "Completed", checkInTime: "08:45 AM" },
  { id: "q2", tokenNo: 2, patientName: "Anita Sharma", registrationNumber: "EZY-2026-0002", doctorName: "Dr. Anil Mehta", timeSlot: "9:00 AM", opdType: "Follow Up", status: "Completed", checkInTime: "08:50 AM" },
  { id: "q3", tokenNo: 3, patientName: "Suresh Kumar", registrationNumber: "EZY-2026-0003", doctorName: "Dr. Priya Singh", timeSlot: "9:00 AM", opdType: "Normal", status: "In Consultation", checkInTime: "08:55 AM" },
  { id: "q4", tokenNo: 4, patientName: "Meena Devi", registrationNumber: "EZY-2026-0004", doctorName: "Dr. Anil Mehta", timeSlot: "9:30 AM", opdType: "Emergency", status: "Waiting", checkInTime: "09:10 AM" },
  { id: "q5", tokenNo: 5, patientName: "Vikram Singh", registrationNumber: "EZY-2026-0005", doctorName: "Dr. Ravi Patel", timeSlot: "10:00 AM", opdType: "Normal", status: "Waiting", checkInTime: "09:30 AM" },
  { id: "q6", tokenNo: 6, patientName: "Pooja Nair", registrationNumber: "EZY-2026-0006", doctorName: "Dr. Sneha Gupta", timeSlot: "9:00 AM", opdType: "Normal", status: "Waiting", checkInTime: "09:35 AM" },
  { id: "q7", tokenNo: 7, patientName: "Arjun Reddy", registrationNumber: "EZY-2026-0007", doctorName: "Dr. Priya Singh", timeSlot: "9:30 AM", opdType: "Follow Up", status: "Waiting", checkInTime: "09:40 AM" },
  { id: "q8", tokenNo: 8, patientName: "Lakshmi Iyer", registrationNumber: "EZY-2026-0008", doctorName: "Dr. Anil Mehta", timeSlot: "10:00 AM", opdType: "Normal", status: "No Show", checkInTime: "" },
];

export const mockClinicPatients: ClinicPatient[] = [
  { id: "1", registrationNumber: "EZY-2026-0001", name: "Rahul Verma", mobile: "9876543210", gender: "Male", age: 36, lastVisit: "2026-02-28", totalVisits: 8, doctor: "Dr. Anil Mehta", diagnosis: "Type 2 Diabetes" },
  { id: "2", registrationNumber: "EZY-2026-0002", name: "Anita Sharma", mobile: "9876543211", gender: "Female", age: 41, lastVisit: "2026-02-28", totalVisits: 3, doctor: "Dr. Anil Mehta", diagnosis: "Seasonal Allergy" },
  { id: "3", registrationNumber: "EZY-2026-0003", name: "Suresh Kumar", mobile: "9123456789", gender: "Male", age: 48, lastVisit: "2026-02-27", totalVisits: 12, doctor: "Dr. Priya Singh", diagnosis: "Hypertension" },
  { id: "4", registrationNumber: "EZY-2026-0004", name: "Meena Devi", mobile: "9988776655", gender: "Female", age: 55, lastVisit: "2026-02-28", totalVisits: 5, doctor: "Dr. Anil Mehta", diagnosis: "Chronic Back Pain" },
  { id: "5", registrationNumber: "EZY-2026-0005", name: "Vikram Singh", mobile: "9112233445", gender: "Male", age: 29, lastVisit: "2026-02-26", totalVisits: 2, doctor: "Dr. Ravi Patel", diagnosis: "Knee Injury" },
  { id: "6", registrationNumber: "EZY-2026-0006", name: "Pooja Nair", mobile: "9223344556", gender: "Female", age: 7, lastVisit: "2026-02-28", totalVisits: 4, doctor: "Dr. Sneha Gupta", diagnosis: "Viral Fever" },
  { id: "7", registrationNumber: "EZY-2026-0007", name: "Arjun Reddy", mobile: "9334455667", gender: "Male", age: 62, lastVisit: "2026-02-25", totalVisits: 15, doctor: "Dr. Priya Singh", diagnosis: "Coronary Artery Disease" },
  { id: "8", registrationNumber: "EZY-2026-0008", name: "Lakshmi Iyer", mobile: "9445566778", gender: "Female", age: 33, lastVisit: "2026-02-24", totalVisits: 1, doctor: "Dr. Anil Mehta", diagnosis: "Migraine" },
];
