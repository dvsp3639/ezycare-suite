// Inventory Module Types

export type InventoryCategory = "Medicine" | "Surgical Items" | "Lab Reagents" | "Consumables" | "Equipment" | "Stationery" | "Cleaning Material" | "Beds" | "Wards";
export type Department = "Store" | "Pharmacy" | "ICU" | "OT" | "Lab" | "Ward A" | "Ward B" | "Emergency" | "Admin";

export interface InventoryItem {
  id: string;
  hospital_id: string;
  name: string;
  category: InventoryCategory;
  sku: string;
  batch_no: string;
  manufacturer: string;
  unit_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  hsn_code: string;
  gst_percent: number;
  expiry_date: string | null;
  department: Department;
  barcode: string;
  vendor: string;
  purchase_date: string | null;
  consumption_rate: number;
  created_at: string;
  updated_at: string;
}

export interface StockTransfer {
  id: string;
  hospital_id: string;
  item_id: string | null;
  item_name: string;
  from_dept: string;
  to_dept: string;
  quantity: number;
  transfer_date: string;
  transferred_by: string;
  status: "Pending" | "Completed" | "Rejected";
  notes: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  hospital_id: string;
  name: string;
  contact: string;
  email: string;
  gst_no: string;
  categories: string[];
  rating: number;
  avg_delivery_days: number;
  last_order_date: string | null;
  created_at: string;
}

export type InventoryItemInsert = Omit<InventoryItem, "id" | "created_at" | "updated_at" | "hospital_id"> & {
  hospital_id?: string;
};
