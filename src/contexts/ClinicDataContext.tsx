import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  mockDoctorSchedules,
  mockQueue,
  mockClinicPatients,
  type DoctorSchedule,
  type QueueEntry,
  type ClinicPatient,
  type Vitals,
  type LabOrder,
  type LabResult,
  type PrescriptionItem,
} from "@/data/mockClinicData";

interface ClinicDataContextType {
  schedules: DoctorSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<DoctorSchedule[]>>;
  queue: QueueEntry[];
  setQueue: React.Dispatch<React.SetStateAction<QueueEntry[]>>;
  clinicPatients: ClinicPatient[];
  addToQueue: (entry: Omit<QueueEntry, "id" | "tokenNo">) => void;
  updateQueueStatus: (id: string, status: QueueEntry["status"]) => void;
  updateQueueConsultation: (id: string, data: { diagnosis: string; prescription: string[]; structuredPrescription: PrescriptionItem[]; notes: string }) => void;
  updateQueueVitals: (id: string, vitals: Vitals) => void;
  updateQueueLabOrders: (id: string, labOrders: LabOrder[]) => void;
  updateQueueFollowUp: (id: string, followUpDate: string) => void;
  incrementSlotBooked: (doctorId: string, slotTime: string) => void;
  // Diagnostics workflow
  allLabOrders: LabOrder[];
  updateLabOrderStatus: (labOrderId: string, status: LabOrder["status"]) => void;
  updateLabOrderResults: (labOrderId: string, results: LabResult[], reportNotes?: string) => void;
}

const ClinicDataContext = createContext<ClinicDataContextType | null>(null);

export const useClinicData = () => {
  const ctx = useContext(ClinicDataContext);
  if (!ctx) throw new Error("useClinicData must be used within ClinicDataProvider");
  return ctx;
};

export const ClinicDataProvider = ({ children }: { children: ReactNode }) => {
  const [schedules, setSchedules] = useState<DoctorSchedule[]>(mockDoctorSchedules);
  const [queue, setQueue] = useState<QueueEntry[]>(mockQueue);
  const [clinicPatients] = useState<ClinicPatient[]>(mockClinicPatients);

  const addToQueue = useCallback((entry: Omit<QueueEntry, "id" | "tokenNo">) => {
    setQueue((prev) => {
      const maxToken = prev.reduce((max, q) => Math.max(max, q.tokenNo), 0);
      const newEntry: QueueEntry = { ...entry, id: `q-${Date.now()}`, tokenNo: maxToken + 1 };
      return [...prev, newEntry];
    });
  }, []);

  const updateQueueStatus = useCallback((id: string, status: QueueEntry["status"]) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
  }, []);

  const updateQueueConsultation = useCallback((id: string, data: { diagnosis: string; prescription: string[]; structuredPrescription: PrescriptionItem[]; notes: string }) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, status: "Completed" as const, diagnosis: data.diagnosis, prescription: data.prescription, structuredPrescription: data.structuredPrescription, doctorNotes: data.notes }
          : q
      )
    );
  }, []);

  const updateQueueVitals = useCallback((id: string, vitals: Vitals) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, vitals } : q)));
  }, []);

  const updateQueueLabOrders = useCallback((id: string, labOrders: LabOrder[]) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, labOrders } : q)));
  }, []);

  const updateQueueFollowUp = useCallback((id: string, followUpDate: string) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, followUpDate } : q)));
  }, []);

  const incrementSlotBooked = useCallback((doctorId: string, slotTime: string) => {
    setSchedules((prev) =>
      prev.map((doc) =>
        doc.id === doctorId
          ? { ...doc, timeSlots: doc.timeSlots.map((s) => s.time === slotTime ? { ...s, bookedPatients: s.bookedPatients + 1 } : s) }
          : doc
      )
    );
  }, []);

  // Collect all lab orders from all queue entries
  const allLabOrders = queue.flatMap((q) =>
    (q.labOrders || []).map((lab) => ({ ...lab }))
  );

  const updateLabOrderStatus = useCallback((labOrderId: string, status: LabOrder["status"]) => {
    setQueue((prev) =>
      prev.map((q) => ({
        ...q,
        labOrders: q.labOrders?.map((lab) =>
          lab.id === labOrderId
            ? { ...lab, status, ...(status === "Sample Collected" ? { sampleCollectedAt: new Date().toLocaleTimeString() } : {}), ...(status === "Completed" ? { completedAt: new Date().toLocaleTimeString() } : {}) }
            : lab
        ),
      }))
    );
  }, []);

  const updateLabOrderResults = useCallback((labOrderId: string, results: LabResult[], reportNotes?: string) => {
    setQueue((prev) =>
      prev.map((q) => ({
        ...q,
        labOrders: q.labOrders?.map((lab) =>
          lab.id === labOrderId
            ? { ...lab, results, reportNotes, status: "Completed" as const, completedAt: new Date().toLocaleTimeString() }
            : lab
        ),
      }))
    );
  }, []);

  return (
    <ClinicDataContext.Provider
      value={{ schedules, setSchedules, queue, setQueue, clinicPatients, addToQueue, updateQueueStatus, updateQueueConsultation, updateQueueVitals, updateQueueLabOrders, updateQueueFollowUp, incrementSlotBooked, allLabOrders, updateLabOrderStatus, updateLabOrderResults }}
    >
      {children}
    </ClinicDataContext.Provider>
  );
};
