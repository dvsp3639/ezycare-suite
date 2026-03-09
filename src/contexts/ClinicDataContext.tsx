import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { clinicService } from "@/modules/clinic/services";
import { staffService } from "@/modules/staff/services";
import { diagnosticsService } from "@/modules/diagnostics/services";
import type { Appointment } from "@/modules/clinic/types";
import {
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
  allLabOrders: LabOrder[];
  updateLabOrderStatus: (labOrderId: string, status: LabOrder["status"]) => void;
  updateLabOrderResults: (labOrderId: string, results: LabResult[], reportNotes?: string, reportFiles?: { name: string; url: string; type: string }[]) => void;
  updateLabOrderPayment: (labOrderId: string, paymentMode: "Cash" | "Credit") => void;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const ClinicDataContext = createContext<ClinicDataContextType | null>(null);

export const useClinicData = () => {
  const ctx = useContext(ClinicDataContext);
  if (!ctx) throw new Error("useClinicData must be used within ClinicDataProvider");
  return ctx;
};

// Map DB schedule to mock DoctorSchedule shape
function mapDbSchedule(s: any): DoctorSchedule {
  return {
    id: s.id,
    doctorName: s.doctorName,
    specialization: s.specialization || "",
    availableFrom: s.availableFrom || "9:00 AM",
    availableTo: s.availableTo || "5:00 PM",
    consultationDuration: s.consultationDuration || 30,
    timeSlots: (s.timeSlots || []).map((ts: any) => ({
      id: ts.id,
      time: ts.time,
      maxPatients: ts.maxPatients ?? 5,
      bookedPatients: ts.bookedPatients ?? 0,
      isActive: ts.isActive ?? true,
    })),
  };
}

// Map DB appointment to QueueEntry shape
function mapDbAppointment(a: any): QueueEntry {
  const vitalsArr = a.vitals || [];
  const v = vitalsArr[0];
  const prescriptions = a.prescriptions || [];
  return {
    id: a.id,
    tokenNo: a.tokenNo,
    patientName: a.patientName,
    registrationNumber: a.registrationNumber,
    doctorName: a.doctorName,
    timeSlot: a.timeSlot || "",
    opdType: a.opdType || "Normal",
    status: a.status || "Waiting",
    checkInTime: a.checkInTime || "",
    diagnosis: a.diagnosis || undefined,
    doctorNotes: a.doctorNotes || undefined,
    followUpDate: a.followUpDate || undefined,
    vitals: v ? { bp: v.bp || "", temperature: v.temperature || "", weight: v.weight || "", height: v.height || "", spo2: v.spo2 || "", pulse: v.pulse || "" } : undefined,
    structuredPrescription: prescriptions.length > 0 ? prescriptions.map((p: any) => ({
      medicine: p.medicine || "",
      dosage: p.dosage || "",
      frequency: p.frequency || "",
      duration: p.duration || "",
      instructions: p.instructions || "",
    })) : undefined,
    prescription: prescriptions.length > 0 ? prescriptions.map((p: any) =>
      `${p.medicine} ${p.dosage} – ${p.frequency}${p.duration ? ` for ${p.duration}` : ""}${p.instructions ? ` (${p.instructions})` : ""}`
    ) : undefined,
  };
}

export const ClinicDataProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [clinicPatients] = useState<ClinicPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [dbSchedules, dbAppointments] = await Promise.all([
        clinicService.getSchedules(today),
        clinicService.getAppointments(today),
      ]);

      // Try to auto-create schedules for staff doctors without one for today
      let allSchedules = dbSchedules;
      try {
        const staffDoctors = await staffService.getStaff({ role: "Doctor", status: "Active" });
        const scheduledNames = new Set(dbSchedules.map((s: any) => (s.doctorName || "").toLowerCase()));
        const missingDoctors = staffDoctors.filter((d) => !scheduledNames.has((d.name || "").toLowerCase()));

        if (missingDoctors.length > 0) {
          const newSchedules = await Promise.all(
            missingDoctors.map((doc) =>
              clinicService.createSchedule({
                doctorName: doc.name,
                specialization: doc.specialization || doc.designation || "",
                scheduleDate: today,
                availableFrom: "9:00 AM",
                availableTo: "5:00 PM",
                consultationDuration: 30,
              } as any)
            )
          );
          allSchedules = [...dbSchedules, ...newSchedules];
        }
      } catch (staffErr) {
        console.warn("Could not auto-sync staff doctors:", staffErr);
      }

      setSchedules(allSchedules.map(mapDbSchedule));
      setQueue(dbAppointments.map(mapDbAppointment));
    } catch (err) {
      console.error("Failed to load clinic data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addToQueue = useCallback((entry: Omit<QueueEntry, "id" | "tokenNo">) => {
    setQueue((prev) => {
      const maxToken = prev.reduce((max, q) => Math.max(max, q.tokenNo), 0);
      const newEntry: QueueEntry = { ...entry, id: `q-${Date.now()}`, tokenNo: maxToken + 1 };
      return [...prev, newEntry];
    });
  }, []);

  const updateQueueStatus = useCallback((id: string, status: QueueEntry["status"]) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    // Persist to DB
    clinicService.updateAppointment(id, { status } as any).catch(console.error);
  }, []);

  const updateQueueConsultation = useCallback((id: string, data: { diagnosis: string; prescription: string[]; structuredPrescription: PrescriptionItem[]; notes: string }) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, status: "Completed" as const, diagnosis: data.diagnosis, prescription: data.prescription, structuredPrescription: data.structuredPrescription, doctorNotes: data.notes }
          : q
      )
    );
    // Persist
    clinicService.updateAppointment(id, { status: "Completed", diagnosis: data.diagnosis, doctorNotes: data.notes } as any).catch(console.error);
    if (data.structuredPrescription.length > 0) {
      clinicService.savePrescriptions(id, data.structuredPrescription).catch(console.error);
    }
  }, []);

  const updateQueueVitals = useCallback((id: string, vitals: Vitals) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, vitals } : q)));
    clinicService.saveVitals({ appointmentId: id, ...vitals } as any).catch(console.error);
  }, []);

  const updateQueueLabOrders = useCallback(async (id: string, labOrders: LabOrder[]) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, labOrders } : q)));
    // Persist each new lab order to DB
    for (const lab of labOrders) {
      if (lab.id.startsWith("lab-")) {
        try {
          const created = await diagnosticsService.createLabOrder({
            appointment_id: id,
            test_name: lab.testName,
            category: lab.category,
            priority: lab.priority,
            status: "Ordered",
            price: lab.price,
            clinical_notes: lab.clinicalNotes || "",
            ordered_by: lab.orderedBy,
            patient_name: lab.patientName,
            patient_reg_no: lab.patientRegNo,
            payment_status: "Pending",
            payment_mode: null,
            report_notes: "",
            ordered_at: new Date().toISOString(),
            sample_collected_at: null,
            completed_at: null,
          });
          // Update the local ID to the DB ID
          setQueue((prev) => prev.map((q) => q.id === id ? {
            ...q,
            labOrders: q.labOrders?.map((l) => l.id === lab.id ? { ...l, id: created.id } : l),
          } : q));
          // Invalidate diagnostics queries for cross-module sync
          queryClient.invalidateQueries({ queryKey: ["diagnostics"] });
        } catch (err) {
          console.error("Failed to persist lab order:", err);
        }
      }
    }
  }, []);

  const updateQueueFollowUp = useCallback((id: string, followUpDate: string) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, followUpDate } : q)));
    clinicService.updateAppointment(id, { followUpDate } as any).catch(console.error);
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

  const allLabOrders = queue.flatMap((q) => (q.labOrders || []).map((lab) => ({ ...lab })));

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
    // Persist to DB
    diagnosticsService.updateLabOrderStatus(labOrderId, status).catch(console.error);
  }, []);

  const updateLabOrderResults = useCallback((labOrderId: string, results: LabResult[], reportNotes?: string, reportFiles?: { name: string; url: string; type: string }[]) => {
    setQueue((prev) =>
      prev.map((q) => ({
        ...q,
        labOrders: q.labOrders?.map((lab) =>
          lab.id === labOrderId
            ? { ...lab, results, reportNotes, reportFiles, status: "Completed" as const, completedAt: new Date().toLocaleTimeString() }
            : lab
        ),
      }))
    );
    // Persist results to DB
    const dbResults = results.map((r) => ({
      parameter: r.parameter,
      value: r.value,
      unit: r.unit,
      normal_range: r.normalRange,
      is_abnormal: r.isAbnormal,
    }));
    diagnosticsService.saveResults(labOrderId, dbResults, reportNotes).catch(console.error);
  }, []);

  const updateLabOrderPayment = useCallback((labOrderId: string, paymentMode: "Cash" | "Credit") => {
    setQueue((prev) =>
      prev.map((q) => ({
        ...q,
        labOrders: q.labOrders?.map((lab) =>
          lab.id === labOrderId
            ? { ...lab, paymentStatus: "Paid" as const, paymentMode }
            : lab
        ),
      }))
    );
    // Persist to DB
    diagnosticsService.updateLabOrderPayment(labOrderId, paymentMode).catch(console.error);
  }, []);

  return (
    <ClinicDataContext.Provider
      value={{ schedules, setSchedules, queue, setQueue, clinicPatients, addToQueue, updateQueueStatus, updateQueueConsultation, updateQueueVitals, updateQueueLabOrders, updateQueueFollowUp, incrementSlotBooked, allLabOrders, updateLabOrderStatus, updateLabOrderResults, updateLabOrderPayment, isLoading, refreshData }}
    >
      {children}
    </ClinicDataContext.Provider>
  );
};
