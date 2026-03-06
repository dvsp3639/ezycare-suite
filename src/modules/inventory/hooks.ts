import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "./services";
import type { InventoryItemInsert, StockTransfer, Vendor } from "./types";

const KEYS = {
  items: (filters?: any) => ["inventory", "items", filters] as const,
  transfers: ["inventory", "transfers"] as const,
  vendors: ["inventory", "vendors"] as const,
};

export function useInventoryItems(filters?: { category?: string; department?: string }) {
  return useQuery({
    queryKey: KEYS.items(filters),
    queryFn: () => inventoryService.getItems(filters),
  });
}

export function useStockTransfers() {
  return useQuery({
    queryKey: KEYS.transfers,
    queryFn: inventoryService.getTransfers,
  });
}

export function useVendors() {
  return useQuery({
    queryKey: KEYS.vendors,
    queryFn: inventoryService.getVendors,
  });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: InventoryItemInsert) => inventoryService.createItem(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<any> }) =>
      inventoryService.updateItem(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transfer: Partial<StockTransfer>) => inventoryService.createTransfer(transfer),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vendor: Partial<Vendor>) => inventoryService.createVendor(vendor),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.vendors }),
  });
}
