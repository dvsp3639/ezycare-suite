import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pharmacyService } from "./services";
import type { MedicineInsert, PharmacyOrder, PharmacyOrderItem } from "./types";

const KEYS = {
  medicines: ["pharmacy", "medicines"] as const,
  medicineSearch: (q: string) => ["pharmacy", "medicines", "search", q] as const,
  orders: (filters?: any) => ["pharmacy", "orders", filters] as const,
};

export function useMedicines() {
  return useQuery({
    queryKey: KEYS.medicines,
    queryFn: pharmacyService.getMedicines,
  });
}

export function useSearchMedicines(query: string) {
  return useQuery({
    queryKey: KEYS.medicineSearch(query),
    queryFn: () => pharmacyService.searchMedicines(query),
    enabled: query.length >= 2,
  });
}

export function usePharmacyOrders(filters?: { status?: string; issue_type?: string }) {
  return useQuery({
    queryKey: KEYS.orders(filters),
    queryFn: () => pharmacyService.getOrders(filters),
  });
}

export function useCreateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (medicine: MedicineInsert) => pharmacyService.createMedicine(medicine),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.medicines }),
  });
}

export function useCreatePharmacyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ order, items }: { order: Partial<PharmacyOrder>; items: Omit<PharmacyOrderItem, "id" | "order_id">[] }) =>
      pharmacyService.createOrder(order, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pharmacy"] }),
  });
}

export function useUpdateMedicineStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stockChange }: { id: string; stockChange: number }) =>
      pharmacyService.updateMedicineStock(id, stockChange),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.medicines }),
  });
}
