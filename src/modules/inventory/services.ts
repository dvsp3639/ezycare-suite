import { supabase } from "@/integrations/supabase/client";
import type { InventoryItem, StockTransfer, Vendor, InventoryItemInsert } from "./types";

export const inventoryService = {
  // ─── Inventory Items ───
  async getItems(filters?: { category?: string; department?: string }): Promise<InventoryItem[]> {
    let query = supabase.from("inventory_items").select("*").order("name");
    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.department) query = query.eq("department", filters.department);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as InventoryItem[];
  },

  async createItem(item: InventoryItemInsert): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from("inventory_items")
      .insert(item as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as InventoryItem;
  },

  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from("inventory_items")
      .update(updates as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as InventoryItem;
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── Stock Transfers ───
  async getTransfers(): Promise<StockTransfer[]> {
    const { data, error } = await supabase
      .from("stock_transfers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as StockTransfer[];
  },

  async createTransfer(transfer: Partial<StockTransfer>): Promise<StockTransfer> {
    const { data, error } = await supabase
      .from("stock_transfers")
      .insert(transfer as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as StockTransfer;
  },

  async updateTransferStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from("stock_transfers")
      .update({ status } as any)
      .eq("id", id);
    if (error) throw error;
  },

  // ─── Vendors ───
  async getVendors(): Promise<Vendor[]> {
    const { data, error } = await supabase.from("vendors").select("*").order("name");
    if (error) throw error;
    return (data || []) as unknown as Vendor[];
  },

  async createVendor(vendor: Partial<Vendor>): Promise<Vendor> {
    const { data, error } = await supabase
      .from("vendors")
      .insert(vendor as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Vendor;
  },

  async updateVendor(id: string, updates: Partial<Vendor>): Promise<Vendor> {
    const { data, error } = await supabase
      .from("vendors")
      .update(updates as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Vendor;
  },
};
