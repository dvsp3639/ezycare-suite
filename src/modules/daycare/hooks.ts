import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { daycareService, daycareCaseService } from "./services";
import type { DayCareTreatment, DayCareSession, DayCareSessionTreatment, DayCareBill, DayCareBillItem } from "./types";

const KEYS = {
  treatments: ["daycare", "treatments"] as const,
  sessions: (date?: string, status?: string) => ["daycare", "sessions", date, status] as const,
};

export function useDayCareTreatments() {
  return useQuery({ queryKey: KEYS.treatments, queryFn: daycareService.getTreatments });
}

export function useDayCareSessions(date?: string, status?: string) {
  return useQuery({
    queryKey: KEYS.sessions(date, status),
    queryFn: () => daycareService.getSessions(date, status),
  });
}

export function useCreateDayCareTreatment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treatment: Partial<DayCareTreatment>) => daycareService.createTreatment(treatment),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.treatments }),
  });
}

export function useCreateDayCareSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (session: Partial<DayCareSession>) => daycareService.createSession(session),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daycare"] }),
  });
}

export function useUpdateDayCareSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DayCareSession> }) =>
      daycareService.updateSession(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daycare"] }),
  });
}

export function useAddSessionTreatment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treatment: Partial<DayCareSessionTreatment>) => daycareService.addSessionTreatment(treatment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daycare"] }),
  });
}

export function useUpdateSessionTreatment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DayCareSessionTreatment> }) =>
      daycareService.updateSessionTreatment(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daycare"] }),
  });
}

export function useCreateDayCareBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bill, items }: { bill: Partial<DayCareBill>; items: Omit<DayCareBillItem, "id" | "bill_id" | "hospital_id">[] }) =>
      daycareService.createBill(bill, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daycare"] }),
  });
}

/* ── Case workflow hooks ── */

export function useDayCareCase(id: string) {
  return useQuery({
    queryKey: ["daycare", "case", id],
    queryFn: () => daycareCaseService.getCase(id),
    enabled: !!id,
  });
}

export function useDayCareCaseMutations(sessionId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["daycare", "case", sessionId] });
    qc.invalidateQueries({ queryKey: ["daycare", "sessions"] });
  };
  return {
    invalidate,
    addItem: async (item: any, log?: string) => {
      const created = await daycareCaseService.addItem({ ...item, session_id: sessionId });
      if (log) await daycareCaseService.logEvent(sessionId, log, item.name || "");
      invalidate();
      return created;
    },
    updateItem: async (id: string, updates: any) => {
      await daycareCaseService.updateItem(id, updates);
      invalidate();
    },
    deleteItem: async (id: string, name?: string) => {
      await daycareCaseService.deleteItem(id);
      if (name) await daycareCaseService.logEvent(sessionId, "Item Removed", name);
      invalidate();
    },
    updateCase: async (updates: any, log?: string, details = "") => {
      await daycareCaseService.updateCase(sessionId, updates);
      if (log) await daycareCaseService.logEvent(sessionId, log, details);
      invalidate();
    },
    logEvent: async (event: string, details = "") => {
      await daycareCaseService.logEvent(sessionId, event, details);
      invalidate();
    },
  };
}
