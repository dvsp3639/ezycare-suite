import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { diagnosticsService } from "./services";
import type { LabOrderInsert, LabResult } from "./types";

const KEYS = {
  catalog: ["diagnostics", "catalog"] as const,
  orders: (filters?: any) => ["diagnostics", "orders", filters] as const,
};

export function useLabTestCatalog() {
  return useQuery({
    queryKey: KEYS.catalog,
    queryFn: diagnosticsService.getTestCatalog,
  });
}

export function useLabOrders(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: KEYS.orders(filters),
    queryFn: () => diagnosticsService.getLabOrders(filters),
  });
}

export function useCreateLabOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: LabOrderInsert) => diagnosticsService.createLabOrder(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostics"] }),
  });
}

export function useUpdateLabOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, extraFields }: { id: string; status: string; extraFields?: Record<string, any> }) =>
      diagnosticsService.updateLabOrderStatus(id, status, extraFields),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostics"] }),
  });
}

export function useUpdateLabOrderPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentMode }: { id: string; paymentMode: "Cash" | "Credit" }) =>
      diagnosticsService.updateLabOrderPayment(id, paymentMode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostics"] }),
  });
}

export function useSaveLabResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ labOrderId, results, reportNotes }: { labOrderId: string; results: Omit<LabResult, "id" | "lab_order_id">[]; reportNotes?: string }) =>
      diagnosticsService.saveResults(labOrderId, results, reportNotes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostics"] }),
  });
}
