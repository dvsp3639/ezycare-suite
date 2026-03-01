import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  mockDoctorSchedules,
  mockQueue,
  mockClinicPatients,
  type DoctorSchedule,
  type QueueEntry,
  type ClinicPatient,
} from "@/data/mockClinicData";

interface ClinicDataContextType {
  schedules: DoctorSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<DoctorSchedule[]>>;
  queue: QueueEntry[];
  setQueue: React.Dispatch<React.SetStateAction<QueueEntry[]>>;
  clinicPatients: ClinicPatient[];
  addToQueue: (entry: Omit<QueueEntry, "id" | "tokenNo">) => void;
  updateQueueStatus: (id: string, status: QueueEntry["status"]) => void;
  updateQueueConsultation: (id: string, data: { diagnosis: string; prescription: string[]; notes: string }) => void;
  incrementSlotBooked: (doctorId: string, slotTime: string) => void;
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
      const newEntry: QueueEntry = {
        ...entry,
        id: `q-${Date.now()}`,
        tokenNo: maxToken + 1,
      };
      return [...prev, newEntry];
    });
  }, []);

  const updateQueueStatus = useCallback((id: string, status: QueueEntry["status"]) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
  }, []);

  const updateQueueConsultation = useCallback((id: string, data: { diagnosis: string; prescription: string[]; notes: string }) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, status: "Completed" as const, diagnosis: data.diagnosis, prescription: data.prescription, doctorNotes: data.notes }
          : q
      )
    );
  }, []);

  const incrementSlotBooked = useCallback((doctorId: string, slotTime: string) => {
    setSchedules((prev) =>
      prev.map((doc) =>
        doc.id === doctorId
          ? {
              ...doc,
              timeSlots: doc.timeSlots.map((s) =>
                s.time === slotTime ? { ...s, bookedPatients: s.bookedPatients + 1 } : s
              ),
            }
          : doc
      )
    );
  }, []);

  return (
    <ClinicDataContext.Provider
      value={{
        schedules,
        setSchedules,
        queue,
        setQueue,
        clinicPatients,
        addToQueue,
        updateQueueStatus,
        updateQueueConsultation,
        incrementSlotBooked,
      }}
    >
      {children}
    </ClinicDataContext.Provider>
  );
};
