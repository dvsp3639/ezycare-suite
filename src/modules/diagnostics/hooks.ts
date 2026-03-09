import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { diagnosticsService } from "./services";
import type { LabTestCatalogItem, LabOrderInsert, LabResult, LabTestParameter } from "./types";

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

export function useLabOrders(filters?: { status?: string; category?: string; appointmentId?: string }) {
  return useQuery({
    queryKey: KEYS.orders(filters),
    queryFn: () => diagnosticsService.getLabOrders(filters),
    refetchInterval: 15000, // Auto-refresh every 15s for cross-module sync
  });
}

export function useCreateTestCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, parameters }: { item: Partial<LabTestCatalogItem>; parameters: Omit<LabTestParameter, "id" | "test_id" | "hospital_id">[] }) => {
      const created = await diagnosticsService.createTestCatalogItem(item);
      if (parameters.length > 0) {
        await diagnosticsService.saveTestParameters(created.id, parameters);
      }
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.catalog }),
  });
}

export function useUpdateTestCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates, parameters }: { id: string; updates: Partial<LabTestCatalogItem>; parameters?: Omit<LabTestParameter, "id" | "test_id" | "hospital_id">[] }) => {
      await diagnosticsService.updateTestCatalogItem(id, updates);
      if (parameters) {
        await diagnosticsService.saveTestParameters(id, parameters);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.catalog }),
  });
}

export function useDeleteTestCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => diagnosticsService.deleteTestCatalogItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.catalog }),
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
    mutationFn: ({ labOrderId, results, reportNotes }: { labOrderId: string; results: Omit<LabResult, "id" | "lab_order_id" | "hospital_id">[]; reportNotes?: string }) =>
      diagnosticsService.saveResults(labOrderId, results, reportNotes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostics"] }),
  });
}
