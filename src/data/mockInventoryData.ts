export type InventoryCategory = "Medicine" | "Surgical Items" | "Lab Reagents" | "Consumables" | "Equipment" | "Stationery" | "Cleaning Material" | "Beds" | "Wards";

export type Department = "Store" | "Pharmacy" | "ICU" | "OT" | "Lab" | "Ward A" | "Ward B" | "Emergency" | "Admin";

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  sku: string;
  batchNo: string;
  manufacturer: string;
  unitPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  hsnCode: string;
  gstPercent: number;
  expiryDate?: string;
  department: Department;
  barcode: string;
  lastUpdated: string;
  vendor: string;
  purchaseDate: string;
  consumptionRate: number; // units per month
}

export interface StockTransfer {
  id: string;
  itemId: string;
  itemName: string;
  fromDept: Department;
  toDept: Department;
  quantity: number;
  transferDate: string;
  transferredBy: string;
  status: "Pending" | "Completed" | "Rejected";
  notes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  email: string;
  gstNo: string;
  categories: InventoryCategory[];
  rating: number;
  avgDeliveryDays: number;
  lastOrderDate: string;
}

export const inventoryCategories: InventoryCategory[] = [
  "Medicine", "Surgical Items", "Lab Reagents", "Consumables", "Equipment", "Stationery", "Cleaning Material", "Beds", "Wards",
];

export const departments: Department[] = [
  "Store", "Pharmacy", "ICU", "OT", "Lab", "Ward A", "Ward B", "Emergency", "Admin",
];

export const categoryColors: Record<InventoryCategory, string> = {
  Medicine: "bg-primary/10 text-primary border-primary/20",
  "Surgical Items": "bg-destructive/10 text-destructive border-destructive/20",
  "Lab Reagents": "bg-info/10 text-info border-info/20",
  Consumables: "bg-warning/10 text-warning border-warning/20",
  Equipment: "bg-success/10 text-success border-success/20",
  Stationery: "bg-muted text-muted-foreground border-muted",
  "Cleaning Material": "bg-accent text-accent-foreground border-accent",
  Beds: "bg-info/10 text-info border-info/20",
  Wards: "bg-primary/10 text-primary border-primary/20",
};

export const mockInventory: InventoryItem[] = [
  // Medicines
  { id: "inv-1", name: "Paracetamol 500mg", category: "Medicine", sku: "MED-001", batchNo: "B2026-001", manufacturer: "Cipla", unitPrice: 18, sellingPrice: 25, stock: 500, minStock: 100, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12, expiryDate: "2027-06-30", department: "Pharmacy", barcode: "8901234001", lastUpdated: "2026-03-01", vendor: "MedSupply Co.", purchaseDate: "2026-01-15", consumptionRate: 120 },
  { id: "inv-2", name: "Amoxicillin 500mg", category: "Medicine", sku: "MED-002", batchNo: "B2026-002", manufacturer: "Sun Pharma", unitPrice: 60, sellingPrice: 85, stock: 200, minStock: 50, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12, expiryDate: "2027-03-15", department: "Pharmacy", barcode: "8901234002", lastUpdated: "2026-03-01", vendor: "PharmaWhole Ltd.", purchaseDate: "2026-01-10", consumptionRate: 45 },
  { id: "inv-3", name: "Metformin 500mg", category: "Medicine", sku: "MED-003", batchNo: "B2026-003", manufacturer: "USV Ltd", unitPrice: 30, sellingPrice: 45, stock: 350, minStock: 80, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12, expiryDate: "2026-05-30", department: "Pharmacy", barcode: "8901234003", lastUpdated: "2026-02-28", vendor: "MedSupply Co.", purchaseDate: "2026-01-20", consumptionRate: 90 },
  { id: "inv-4", name: "Amlodipine 5mg", category: "Medicine", sku: "MED-004", batchNo: "B2026-004", manufacturer: "Torrent Pharma", unitPrice: 38, sellingPrice: 55, stock: 15, minStock: 60, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12, expiryDate: "2027-12-31", department: "Pharmacy", barcode: "8901234004", lastUpdated: "2026-02-25", vendor: "PharmaWhole Ltd.", purchaseDate: "2026-02-01", consumptionRate: 70 },
  { id: "inv-5", name: "Omeprazole 20mg", category: "Medicine", sku: "MED-005", batchNo: "B2026-005", manufacturer: "Dr. Reddy's", unitPrice: 45, sellingPrice: 65, stock: 400, minStock: 100, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12, expiryDate: "2026-04-15", department: "Pharmacy", barcode: "8901234005", lastUpdated: "2026-03-01", vendor: "MedSupply Co.", purchaseDate: "2026-01-25", consumptionRate: 110 },
  { id: "inv-6", name: "Insulin Glargine", category: "Medicine", sku: "MED-006", batchNo: "B2026-006", manufacturer: "Sanofi", unitPrice: 800, sellingPrice: 1200, stock: 30, minStock: 10, unit: "Pen", hsnCode: "3004", gstPercent: 5, expiryDate: "2026-09-30", department: "Pharmacy", barcode: "8901234006", lastUpdated: "2026-02-20", vendor: "GlobalMed Inc.", purchaseDate: "2026-02-10", consumptionRate: 8 },

  // Surgical Items
  { id: "inv-7", name: "Surgical Gloves (Sterile)", category: "Surgical Items", sku: "SUR-001", batchNo: "S2026-001", manufacturer: "Medline", unitPrice: 8, sellingPrice: 15, stock: 2000, minStock: 500, unit: "Pair", hsnCode: "4015", gstPercent: 12, expiryDate: "2028-12-31", department: "Store", barcode: "8901234007", lastUpdated: "2026-03-01", vendor: "SurgEquip Pvt.", purchaseDate: "2026-01-05", consumptionRate: 400 },
  { id: "inv-8", name: "Suture Kit (Nylon)", category: "Surgical Items", sku: "SUR-002", batchNo: "S2026-002", manufacturer: "Ethicon", unitPrice: 120, sellingPrice: 200, stock: 80, minStock: 20, unit: "Kit", hsnCode: "3006", gstPercent: 12, expiryDate: "2028-06-30", department: "OT", barcode: "8901234008", lastUpdated: "2026-02-28", vendor: "SurgEquip Pvt.", purchaseDate: "2026-02-01", consumptionRate: 15 },
  { id: "inv-9", name: "Disposable Scalpel #15", category: "Surgical Items", sku: "SUR-003", batchNo: "S2026-003", manufacturer: "Swann-Morton", unitPrice: 25, sellingPrice: 45, stock: 150, minStock: 30, unit: "Piece", hsnCode: "9018", gstPercent: 12, department: "OT", barcode: "8901234009", lastUpdated: "2026-03-01", vendor: "SurgEquip Pvt.", purchaseDate: "2026-01-15", consumptionRate: 20 },

  // Lab Reagents
  { id: "inv-10", name: "CBC Reagent Pack", category: "Lab Reagents", sku: "LAB-001", batchNo: "L2026-001", manufacturer: "Sysmex", unitPrice: 3500, sellingPrice: 3500, stock: 12, minStock: 3, unit: "Pack (100 tests)", hsnCode: "3822", gstPercent: 18, expiryDate: "2026-08-31", department: "Lab", barcode: "8901234010", lastUpdated: "2026-03-01", vendor: "LabChem Supplies", purchaseDate: "2026-02-15", consumptionRate: 3 },
  { id: "inv-11", name: "Urine Dipstick Strips", category: "Lab Reagents", sku: "LAB-002", batchNo: "L2026-002", manufacturer: "Siemens", unitPrice: 1200, sellingPrice: 1200, stock: 25, minStock: 5, unit: "Bottle (100)", hsnCode: "3822", gstPercent: 18, expiryDate: "2026-06-15", department: "Lab", barcode: "8901234011", lastUpdated: "2026-02-25", vendor: "LabChem Supplies", purchaseDate: "2026-01-20", consumptionRate: 6 },
  { id: "inv-12", name: "Blood Collection Tubes (EDTA)", category: "Lab Reagents", sku: "LAB-003", batchNo: "L2026-003", manufacturer: "BD Vacutainer", unitPrice: 12, sellingPrice: 12, stock: 800, minStock: 200, unit: "Tube", hsnCode: "3822", gstPercent: 18, expiryDate: "2027-03-31", department: "Lab", barcode: "8901234012", lastUpdated: "2026-03-01", vendor: "LabChem Supplies", purchaseDate: "2026-02-01", consumptionRate: 150 },

  // Consumables
  { id: "inv-13", name: "Disposable Syringes 5ml", category: "Consumables", sku: "CON-001", batchNo: "C2026-001", manufacturer: "Hindustan Syringes", unitPrice: 4, sellingPrice: 8, stock: 3000, minStock: 500, unit: "Piece", hsnCode: "9018", gstPercent: 12, department: "Store", barcode: "8901234013", lastUpdated: "2026-03-01", vendor: "MedSupply Co.", purchaseDate: "2026-01-10", consumptionRate: 600 },
  { id: "inv-14", name: "Cotton Roll 500g", category: "Consumables", sku: "CON-002", batchNo: "C2026-002", manufacturer: "Johnson & Johnson", unitPrice: 80, sellingPrice: 120, stock: 50, minStock: 15, unit: "Roll", hsnCode: "5601", gstPercent: 12, department: "Store", barcode: "8901234014", lastUpdated: "2026-02-28", vendor: "MedSupply Co.", purchaseDate: "2026-02-05", consumptionRate: 12 },
  { id: "inv-15", name: "IV Cannula 20G", category: "Consumables", sku: "CON-003", batchNo: "C2026-003", manufacturer: "BD", unitPrice: 30, sellingPrice: 55, stock: 400, minStock: 100, unit: "Piece", hsnCode: "9018", gstPercent: 12, expiryDate: "2028-01-31", department: "ICU", barcode: "8901234015", lastUpdated: "2026-03-01", vendor: "SurgEquip Pvt.", purchaseDate: "2026-01-25", consumptionRate: 80 },
  { id: "inv-16", name: "N95 Masks", category: "Consumables", sku: "CON-004", batchNo: "C2026-004", manufacturer: "3M", unitPrice: 25, sellingPrice: 40, stock: 0, minStock: 200, unit: "Piece", hsnCode: "6307", gstPercent: 5, department: "Store", barcode: "8901234016", lastUpdated: "2026-02-20", vendor: "SafetyFirst Ltd.", purchaseDate: "2025-12-15", consumptionRate: 300 },

  // Equipment
  { id: "inv-17", name: "Digital BP Monitor", category: "Equipment", sku: "EQP-001", batchNo: "E2026-001", manufacturer: "Omron", unitPrice: 2500, sellingPrice: 3500, stock: 5, minStock: 2, unit: "Piece", hsnCode: "9018", gstPercent: 12, department: "Ward A", barcode: "8901234017", lastUpdated: "2026-02-15", vendor: "MedEquip Traders", purchaseDate: "2026-01-01", consumptionRate: 0 },
  { id: "inv-18", name: "Pulse Oximeter", category: "Equipment", sku: "EQP-002", batchNo: "E2026-002", manufacturer: "Masimo", unitPrice: 8000, sellingPrice: 12000, stock: 3, minStock: 1, unit: "Piece", hsnCode: "9018", gstPercent: 12, department: "ICU", barcode: "8901234018", lastUpdated: "2026-02-10", vendor: "MedEquip Traders", purchaseDate: "2025-11-20", consumptionRate: 0 },
  { id: "inv-19", name: "Wheelchair (Standard)", category: "Equipment", sku: "EQP-003", batchNo: "E2026-003", manufacturer: "Karma", unitPrice: 6000, sellingPrice: 8500, stock: 4, minStock: 2, unit: "Piece", hsnCode: "8713", gstPercent: 5, department: "Store", barcode: "8901234019", lastUpdated: "2026-01-20", vendor: "MedEquip Traders", purchaseDate: "2025-10-10", consumptionRate: 0 },

  // Stationery
  { id: "inv-20", name: "Prescription Pad (100 sheets)", category: "Stationery", sku: "STA-001", batchNo: "ST2026-001", manufacturer: "Local Printing", unitPrice: 40, sellingPrice: 40, stock: 100, minStock: 20, unit: "Pad", hsnCode: "4820", gstPercent: 18, department: "Admin", barcode: "8901234020", lastUpdated: "2026-03-01", vendor: "OfficeMart", purchaseDate: "2026-02-01", consumptionRate: 25 },
  { id: "inv-21", name: "Patient Wristband Roll", category: "Stationery", sku: "STA-002", batchNo: "ST2026-002", manufacturer: "Zebra", unitPrice: 500, sellingPrice: 500, stock: 10, minStock: 3, unit: "Roll (200)", hsnCode: "4821", gstPercent: 18, department: "Admin", barcode: "8901234021", lastUpdated: "2026-02-20", vendor: "OfficeMart", purchaseDate: "2026-01-15", consumptionRate: 2 },

  // Cleaning Material
  { id: "inv-22", name: "Floor Disinfectant 5L", category: "Cleaning Material", sku: "CLN-001", batchNo: "CL2026-001", manufacturer: "Lizol", unitPrice: 250, sellingPrice: 250, stock: 30, minStock: 10, unit: "Can", hsnCode: "3808", gstPercent: 18, department: "Store", barcode: "8901234022", lastUpdated: "2026-03-01", vendor: "CleanCare Dist.", purchaseDate: "2026-02-10", consumptionRate: 8 },
  { id: "inv-23", name: "Hand Sanitizer 500ml", category: "Cleaning Material", sku: "CLN-002", batchNo: "CL2026-002", manufacturer: "Dettol", unitPrice: 120, sellingPrice: 180, stock: 60, minStock: 20, unit: "Bottle", hsnCode: "3808", gstPercent: 18, expiryDate: "2027-06-30", department: "Store", barcode: "8901234023", lastUpdated: "2026-02-28", vendor: "CleanCare Dist.", purchaseDate: "2026-02-05", consumptionRate: 15 },
  { id: "inv-24", name: "Biomedical Waste Bags (Red)", category: "Cleaning Material", sku: "CLN-003", batchNo: "CL2026-003", manufacturer: "SafeDispose", unitPrice: 5, sellingPrice: 5, stock: 500, minStock: 100, unit: "Piece", hsnCode: "3923", gstPercent: 18, department: "Store", barcode: "8901234024", lastUpdated: "2026-03-01", vendor: "CleanCare Dist.", purchaseDate: "2026-01-20", consumptionRate: 100 },

  // Beds
  { id: "inv-25", name: "General Ward Bed", category: "Beds", sku: "BED-001", batchNo: "BD2026-001", manufacturer: "Stryker", unitPrice: 25000, sellingPrice: 25000, stock: 40, minStock: 5, unit: "Piece", hsnCode: "9402", gstPercent: 18, department: "Store", barcode: "8901234025", lastUpdated: "2026-03-01", vendor: "MedEquip Traders", purchaseDate: "2024-01-15", consumptionRate: 0 },
  { id: "inv-26", name: "ICU Bed (Motorized)", category: "Beds", sku: "BED-002", batchNo: "BD2026-002", manufacturer: "Hill-Rom", unitPrice: 250000, sellingPrice: 250000, stock: 6, minStock: 1, unit: "Piece", hsnCode: "9402", gstPercent: 18, department: "ICU", barcode: "8901234026", lastUpdated: "2026-03-01", vendor: "MedEquip Traders", purchaseDate: "2024-06-10", consumptionRate: 0 },
  { id: "inv-27", name: "Semi-Fowler Bed", category: "Beds", sku: "BED-003", batchNo: "BD2026-003", manufacturer: "Paramount", unitPrice: 45000, sellingPrice: 45000, stock: 10, minStock: 2, unit: "Piece", hsnCode: "9402", gstPercent: 18, department: "Store", barcode: "8901234027", lastUpdated: "2026-03-01", vendor: "MedEquip Traders", purchaseDate: "2025-03-20", consumptionRate: 0 },
  { id: "inv-28", name: "Pediatric Crib", category: "Beds", sku: "BED-004", batchNo: "BD2026-004", manufacturer: "Stryker", unitPrice: 35000, sellingPrice: 35000, stock: 4, minStock: 1, unit: "Piece", hsnCode: "9402", gstPercent: 18, department: "Store", barcode: "8901234028", lastUpdated: "2026-02-15", vendor: "MedEquip Traders", purchaseDate: "2025-01-10", consumptionRate: 0 },
  { id: "inv-29", name: "Maternity Bed", category: "Beds", sku: "BED-005", batchNo: "BD2026-005", manufacturer: "Paramount", unitPrice: 55000, sellingPrice: 55000, stock: 10, minStock: 2, unit: "Piece", hsnCode: "9402", gstPercent: 18, department: "Store", barcode: "8901234029", lastUpdated: "2026-02-20", vendor: "MedEquip Traders", purchaseDate: "2024-09-15", consumptionRate: 0 },

  // Wards
  { id: "inv-30", name: "General Ward A", category: "Wards", sku: "WRD-001", batchNo: "W2026-001", manufacturer: "N/A", unitPrice: 0, sellingPrice: 500, stock: 20, minStock: 0, unit: "Beds", hsnCode: "N/A", gstPercent: 0, department: "Ward A", barcode: "8901234030", lastUpdated: "2026-03-01", vendor: "N/A", purchaseDate: "2020-01-01", consumptionRate: 0 },
  { id: "inv-31", name: "General Ward B", category: "Wards", sku: "WRD-002", batchNo: "W2026-002", manufacturer: "N/A", unitPrice: 0, sellingPrice: 500, stock: 20, minStock: 0, unit: "Beds", hsnCode: "N/A", gstPercent: 0, department: "Ward B", barcode: "8901234031", lastUpdated: "2026-03-01", vendor: "N/A", purchaseDate: "2020-01-01", consumptionRate: 0 },
  { id: "inv-32", name: "Semi-Private Ward", category: "Wards", sku: "WRD-003", batchNo: "W2026-003", manufacturer: "N/A", unitPrice: 0, sellingPrice: 1500, stock: 10, minStock: 0, unit: "Beds", hsnCode: "N/A", gstPercent: 0, department: "Ward A", barcode: "8901234032", lastUpdated: "2026-03-01", vendor: "N/A", purchaseDate: "2020-01-01", consumptionRate: 0 },
  { id: "inv-33", name: "Private Ward", category: "Wards", sku: "WRD-004", batchNo: "W2026-004", manufacturer: "N/A", unitPrice: 0, sellingPrice: 3000, stock: 8, minStock: 0, unit: "Beds", hsnCode: "N/A", gstPercent: 0, department: "Ward A", barcode: "8901234033", lastUpdated: "2026-03-01", vendor: "N/A", purchaseDate: "2020-01-01", consumptionRate: 0 },
  { id: "inv-34", name: "ICU", category: "Wards", sku: "WRD-005", batchNo: "W2026-005", manufacturer: "N/A", unitPrice: 0, sellingPrice: 8000, stock: 6, minStock: 0, unit: "Beds", hsnCode: "N/A", gstPercent: 0, department: "ICU", barcode: "8901234034", lastUpdated: "2026-03-01", vendor: "N/A", purchaseDate: "2020-01-01", consumptionRate: 0 },
  { id: "inv-35", name: "NICU", category: "Wards", sku: "WRD-006", batchNo: "W2026-006", manufacturer: "N/A", unitPrice: 0, sellingPrice: 10000, stock: 4, minStock: 0, unit: "Beds", hsnCode: "N/A", gstPercent: 0, department: "ICU", barcode: "8901234035", lastUpdated: "2026-03-01", vendor: "N/A", purchaseDate: "2020-01-01", consumptionRate: 0 },
  { id: "inv-36", name: "Isolation Ward", category: "Wards", sku: "WRD-007", batchNo: "W2026-007", manufacturer: "N/A", unitPrice: 0, sellingPrice: 2000, stock: 4, minStock: 0, unit: "Beds", hsnCode: "N/A", gstPercent: 0, department: "Ward A", barcode: "8901234036", lastUpdated: "2026-03-01", vendor: "N/A", purchaseDate: "2020-01-01", consumptionRate: 0 },
  { id: "inv-37", name: "Maternity Ward", category: "Wards", sku: "WRD-008", batchNo: "W2026-008", manufacturer: "N/A", unitPrice: 0, sellingPrice: 2500, stock: 10, minStock: 0, unit: "Beds", hsnCode: "N/A", gstPercent: 0, department: "Ward B", barcode: "8901234037", lastUpdated: "2026-03-01", vendor: "N/A", purchaseDate: "2020-01-01", consumptionRate: 0 },
];

export const mockTransfers: StockTransfer[] = [
  { id: "tr-1", itemId: "inv-1", itemName: "Paracetamol 500mg", fromDept: "Store", toDept: "Pharmacy", quantity: 100, transferDate: "2026-02-28 10:30 AM", transferredBy: "Amit Kumar", status: "Completed", notes: "Monthly pharma restock" },
  { id: "tr-2", itemId: "inv-15", itemName: "IV Cannula 20G", fromDept: "Store", toDept: "ICU", quantity: 50, transferDate: "2026-02-27 02:15 PM", transferredBy: "Priya Sharma", status: "Completed", notes: "ICU request" },
  { id: "tr-3", itemId: "inv-8", itemName: "Suture Kit (Nylon)", fromDept: "Store", toDept: "OT", quantity: 20, transferDate: "2026-02-26 11:00 AM", transferredBy: "Rajesh Patel", status: "Completed" },
  { id: "tr-4", itemId: "inv-13", itemName: "Disposable Syringes 5ml", fromDept: "Store", toDept: "Ward A", quantity: 200, transferDate: "2026-02-25 09:45 AM", transferredBy: "Amit Kumar", status: "Completed" },
  { id: "tr-5", itemId: "inv-7", itemName: "Surgical Gloves (Sterile)", fromDept: "Store", toDept: "Emergency", quantity: 100, transferDate: "2026-03-01 08:30 AM", transferredBy: "Priya Sharma", status: "Pending" },
  { id: "tr-6", itemId: "inv-14", itemName: "Cotton Roll 500g", fromDept: "Ward A", toDept: "Ward B", quantity: 5, transferDate: "2026-03-01 11:00 AM", transferredBy: "Rajesh Patel", status: "Pending" },
];

export const mockVendors: Vendor[] = [
  { id: "v-1", name: "MedSupply Co.", contact: "9876543001", email: "sales@medsupply.in", gstNo: "29ABCDE1234F1ZK", categories: ["Medicine", "Consumables"], rating: 4.5, avgDeliveryDays: 3, lastOrderDate: "2026-02-28" },
  { id: "v-2", name: "PharmaWhole Ltd.", contact: "9876543002", email: "orders@pharmawhole.com", gstNo: "29FGHIJ5678K2ZL", categories: ["Medicine"], rating: 4.2, avgDeliveryDays: 2, lastOrderDate: "2026-02-25" },
  { id: "v-3", name: "SurgEquip Pvt.", contact: "9876543003", email: "info@surgequip.in", gstNo: "29KLMNO9012P3ZM", categories: ["Surgical Items", "Consumables"], rating: 4.8, avgDeliveryDays: 5, lastOrderDate: "2026-02-20" },
  { id: "v-4", name: "LabChem Supplies", contact: "9876543004", email: "support@labchem.in", gstNo: "29PQRST3456U4ZN", categories: ["Lab Reagents"], rating: 4.0, avgDeliveryDays: 4, lastOrderDate: "2026-02-15" },
  { id: "v-5", name: "GlobalMed Inc.", contact: "9876543005", email: "india@globalmed.com", gstNo: "29UVWXY7890Z5ZO", categories: ["Medicine", "Equipment"], rating: 4.6, avgDeliveryDays: 7, lastOrderDate: "2026-02-10" },
  { id: "v-6", name: "MedEquip Traders", contact: "9876543006", email: "sales@medequip.in", gstNo: "29ABCFG1234H6ZP", categories: ["Equipment"], rating: 3.8, avgDeliveryDays: 10, lastOrderDate: "2026-01-20" },
  { id: "v-7", name: "OfficeMart", contact: "9876543007", email: "bulk@officemart.in", gstNo: "29HIJKL5678M7ZQ", categories: ["Stationery"], rating: 4.3, avgDeliveryDays: 2, lastOrderDate: "2026-02-01" },
  { id: "v-8", name: "CleanCare Dist.", contact: "9876543008", email: "orders@cleancare.in", gstNo: "29NOPQR9012S8ZR", categories: ["Cleaning Material"], rating: 4.1, avgDeliveryDays: 3, lastOrderDate: "2026-02-10" },
  { id: "v-9", name: "SafetyFirst Ltd.", contact: "9876543009", email: "supply@safetyfirst.in", gstNo: "29STUVW3456X9ZS", categories: ["Consumables", "Cleaning Material"], rating: 3.9, avgDeliveryDays: 4, lastOrderDate: "2025-12-15" },
];

// Helper to determine expiry status color
export function getExpiryStatus(expiryDate?: string): { label: string; color: string } {
  if (!expiryDate) return { label: "N/A", color: "text-muted-foreground" };
  const now = new Date();
  const exp = new Date(expiryDate);
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return { label: "Expired", color: "text-destructive bg-destructive/10" };
  if (diffDays <= 30) return { label: `${diffDays}d left`, color: "text-destructive bg-destructive/10" };
  if (diffDays <= 90) return { label: `${diffDays}d left`, color: "text-warning bg-warning/10" };
  if (diffDays <= 180) return { label: `${Math.floor(diffDays / 30)}mo left`, color: "text-warning bg-warning/5" };
  return { label: `${Math.floor(diffDays / 30)}mo left`, color: "text-success bg-success/10" };
}

export function getStockStatus(stock: number, minStock: number): { label: string; color: string } {
  if (stock === 0) return { label: "Out of Stock", color: "text-destructive bg-destructive/10" };
  if (stock <= minStock * 0.5) return { label: "Critical", color: "text-destructive bg-destructive/10" };
  if (stock <= minStock) return { label: "Low Stock", color: "text-warning bg-warning/10" };
  return { label: "In Stock", color: "text-success bg-success/10" };
}
