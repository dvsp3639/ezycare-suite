import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { diagnosticsService } from "./services";
import type { LabTestCatalogItem, LabOrderInsert, LabResult, ParameterSaveInput } from "./types";

const KEYS = {
  catalog: ["diagnostics", "catalog"] as const,
  orders: (filters?: any) => ["diagnostics", "orders", filters] as const,
};

export function useLabTestCatalog() {
  return useQuery({
    queryKey: KEYS.catalog,
    queryFn: diagnosticsService.getTestCatalog,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

export function useLabOrders(filters?: { status?: string; category?: string; appointmentId?: string }) {
  return useQuery({
    queryKey: KEYS.orders(filters),
    queryFn: () => diagnosticsService.getLabOrders(filters),
    refetchInterval: 15000,
  });
}

export function useCreateTestCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, parameters }: { item: Partial<LabTestCatalogItem>; parameters: ParameterSaveInput[] }) => {
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
    mutationFn: async ({ id, updates, parameters }: { id: string; updates: Partial<LabTestCatalogItem>; parameters?: ParameterSaveInput[] }) => {
      await diagnosticsService.updateTestCatalogItem(id, updates);
      if (parameters) {
        await diagnosticsService.saveTestParameters(id, parameters);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.catalog }),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      diagnosticsService.toggleFavorite(id, isFavorite),
    onMutate: async ({ id, isFavorite }) => {
      await qc.cancelQueries({ queryKey: KEYS.catalog });
      const prev = qc.getQueryData(KEYS.catalog);
      qc.setQueryData(KEYS.catalog, (old: any) =>
        old?.map((t: any) => (t.id === id ? { ...t, isFavorite } : t))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(KEYS.catalog, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.catalog }),
  });
}

export function useDeleteTestCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => diagnosticsService.deleteTestCatalogItem(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEYS.catalog });
      const prev = qc.getQueryData(KEYS.catalog);
      qc.setQueryData(KEYS.catalog, (old: any) => old?.filter((t: any) => t.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => { if (ctx?.prev) qc.setQueryData(KEYS.catalog, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.catalog }),
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
    mutationFn: ({ labOrderId, results, reportNotes, reportFileUrl, reportFileName }: { labOrderId: string; results: Omit<LabResult, "id" | "lab_order_id" | "hospital_id">[]; reportNotes?: string; reportFileUrl?: string; reportFileName?: string }) =>
      diagnosticsService.saveResults(labOrderId, results, reportNotes, reportFileUrl, reportFileName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostics"] }),
  });
}
