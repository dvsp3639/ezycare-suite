import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsService } from "./services";
import type { OperatingExpense, PurchaseBill } from "./types";

export const useRevenue = (from: string, to: string) =>
  useQuery({
    queryKey: ["accounts", "revenue", from, to],
    queryFn: () => accountsService.getRevenue(from, to),
    enabled: !!from && !!to,
  });

export const useExpenses = (from: string, to: string) =>
  useQuery({
    queryKey: ["accounts", "expenses", from, to],
    queryFn: () => accountsService.getExpenses(from, to),
    enabled: !!from && !!to,
  });

export const useOperatingExpenses = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["accounts", "operating", from, to],
    queryFn: () => accountsService.getOperatingExpenses(from, to),
  });

export const usePurchaseBills = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["accounts", "purchases", from, to],
    queryFn: () => accountsService.getPurchaseBills(from, to),
  });

export const useCreateOperatingExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Partial<OperatingExpense>) => accountsService.createOperatingExpense(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
};

export const useCreatePurchaseBill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<PurchaseBill>) => accountsService.createPurchaseBill(b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
};

export const useDeleteOperatingExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsService.deleteOperatingExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
};

export const useDeletePurchaseBill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsService.deletePurchaseBill(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
};
