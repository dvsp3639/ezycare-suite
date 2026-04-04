import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Package, Search, Plus, Edit, Trash2, ArrowLeftRight, BarChart3,
  AlertTriangle, CheckCircle2, QrCode, Scan, TrendingUp, TrendingDown,
  Building2, IndianRupee, Clock, XCircle, Landmark, Wrench, CalendarCheck, BedDouble,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  inventoryCategories, departments, categoryColors,
  getExpiryStatus, getStockStatus,
  type InventoryItem, type InventoryCategory, type Department, type StockTransfer,
} from "@/data/mockInventoryData";
import { type LabTestDefinition } from "@/data/mockDiagnosticsData";
import type { LabCategory } from "@/data/mockClinicData";
import { useWardsBeds } from "@/contexts/WardsBedContext";
import { useInventoryItems, useStockTransfers } from "@/modules/inventory/hooks";
import {
  useLabTestCatalog, useCreateTestCatalogItem, useUpdateTestCatalogItem, useDeleteTestCatalogItem,
} from "@/modules/diagnostics/hooks";

// ──── Asset Types ────
export type AssetStatus = "Active" | "Under Maintenance" | "Retired" | "Disposed";
export type AssetCondition = "Good" | "Fair" | "Poor" | "Non-functional";

export interface HospitalAsset {
  id: string;
  name: string;
  assetTag: string;
  category: string;
  department: Department;
  location: string;
  manufacturer: string;
  model: string;
  serialNo: string;
  purchaseDate: string;
  purchaseCost: number;
  warrantyExpiry?: string;
  status: AssetStatus;
  condition: AssetCondition;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  assignedTo?: string;
  notes?: string;
}

const assetStatuses: AssetStatus[] = ["Active", "Under Maintenance", "Retired", "Disposed"];
const assetConditions: AssetCondition[] = ["Good", "Fair", "Poor", "Non-functional"];
const assetCategories = ["Medical Equipment", "Furniture", "IT Equipment", "Vehicles", "Infrastructure", "Instruments"];

const statusColors: Record<AssetStatus, string> = {
  Active: "text-success bg-success/10",
  "Under Maintenance": "text-warning bg-warning/10",
  Retired: "text-muted-foreground bg-muted",
  Disposed: "text-destructive bg-destructive/10",
};
const conditionColors: Record<AssetCondition, string> = {
  Good: "text-success bg-success/10",
  Fair: "text-warning bg-warning/10",
  Poor: "text-destructive bg-destructive/10",
  "Non-functional": "text-destructive bg-destructive/10",
};

const mockAssets: HospitalAsset[] = [
  { id: "ast-1", name: "Ventilator", assetTag: "AST-0001", category: "Medical Equipment", department: "ICU", location: "ICU Bed 3", manufacturer: "Draeger", model: "Savina 300", serialNo: "SN-V001", purchaseDate: "2024-06-15", purchaseCost: 1500000, warrantyExpiry: "2027-06-15", status: "Active", condition: "Good", lastMaintenanceDate: "2026-01-10", nextMaintenanceDate: "2026-04-10", assignedTo: "Dr. Mehta" },
  { id: "ast-2", name: "Defibrillator", assetTag: "AST-0002", category: "Medical Equipment", department: "Emergency", location: "ER Bay 1", manufacturer: "Philips", model: "HeartStart MRx", serialNo: "SN-D002", purchaseDate: "2023-03-20", purchaseCost: 800000, warrantyExpiry: "2026-03-20", status: "Active", condition: "Good", lastMaintenanceDate: "2026-02-01", nextMaintenanceDate: "2026-05-01" },
  { id: "ast-3", name: "Patient Monitor", assetTag: "AST-0003", category: "Medical Equipment", department: "Ward A", location: "Room 201", manufacturer: "GE Healthcare", model: "CARESCAPE B450", serialNo: "SN-PM003", purchaseDate: "2025-01-10", purchaseCost: 350000, warrantyExpiry: "2028-01-10", status: "Active", condition: "Good", lastMaintenanceDate: "2025-12-15", nextMaintenanceDate: "2026-06-15" },
  { id: "ast-4", name: "X-Ray Machine", assetTag: "AST-0004", category: "Medical Equipment", department: "Lab", location: "Radiology Room", manufacturer: "Siemens", model: "Multix Impact", serialNo: "SN-XR004", purchaseDate: "2022-08-01", purchaseCost: 5000000, warrantyExpiry: "2025-08-01", status: "Under Maintenance", condition: "Fair", lastMaintenanceDate: "2026-02-20", nextMaintenanceDate: "2026-03-20", notes: "Annual calibration pending" },
  { id: "ast-5", name: "Hospital Bed (Electric)", assetTag: "AST-0005", category: "Furniture", department: "Ward B", location: "Room 305", manufacturer: "Stryker", model: "InTouch", serialNo: "SN-HB005", purchaseDate: "2024-01-15", purchaseCost: 250000, status: "Active", condition: "Good" },
  { id: "ast-6", name: "Autoclave Sterilizer", assetTag: "AST-0006", category: "Instruments", department: "OT", location: "Sterilization Unit", manufacturer: "Tuttnauer", model: "3870EA", serialNo: "SN-AC006", purchaseDate: "2023-05-01", purchaseCost: 400000, warrantyExpiry: "2026-05-01", status: "Active", condition: "Fair", lastMaintenanceDate: "2026-01-15", nextMaintenanceDate: "2026-07-15" },
  { id: "ast-7", name: "Desktop Computer", assetTag: "AST-0007", category: "IT Equipment", department: "Admin", location: "Reception", manufacturer: "Dell", model: "OptiPlex 7090", serialNo: "SN-PC007", purchaseDate: "2025-06-01", purchaseCost: 65000, warrantyExpiry: "2028-06-01", status: "Active", condition: "Good" },
  { id: "ast-8", name: "Ambulance", assetTag: "AST-0008", category: "Vehicles", department: "Emergency", location: "Parking Bay A", manufacturer: "Force Motors", model: "Traveller", serialNo: "SN-AMB008", purchaseDate: "2024-09-01", purchaseCost: 2500000, status: "Active", condition: "Good", lastMaintenanceDate: "2026-02-10", nextMaintenanceDate: "2026-05-10" },
];

// ──── Main Component ────
const Inventory = () => {
  const { wardInventoryItems, addWard, updateWard, deleteWard, toggleBedMaintenance } = useWardsBeds();
  const { data: dbItems } = useInventoryItems();
  const { data: dbTransfers } = useStockTransfers();
  const { data: dbLabCatalog } = useLabTestCatalog();
  const createTestMutation = useCreateTestCatalogItem();
  const updateTestMutation = useUpdateTestCatalogItem();
  const deleteTestMutation = useDeleteTestCatalogItem();

  const [activeTab, setActiveTab] = useState("stock");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [labTests, setLabTests] = useState<LabTestDefinition[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [labCustomCategories, setLabCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    if (dbItems) {
      setInventory((dbItems as any[]).map((i: any) => ({
        id: i.id, name: i.name, category: i.category || "Consumables",
        sku: i.sku || "", batchNo: i.batchNo || "", manufacturer: i.manufacturer || "",
        unitPrice: i.unitPrice || 0, sellingPrice: i.sellingPrice || 0,
        stock: i.stock || 0, minStock: i.minStock || 0, unit: i.unit || "Piece",
        hsnCode: i.hsnCode || "", gstPercent: i.gstPercent ?? 12,
        expiryDate: i.expiryDate || undefined, department: i.department || "Store",
        barcode: i.barcode || "", lastUpdated: i.updatedAt || "", vendor: i.vendor || "",
        purchaseDate: i.purchaseDate || "", consumptionRate: i.consumptionRate || 0,
      })).filter((i: any) => i.category !== "Wards"));
    }
  }, [dbItems]);

  useEffect(() => {
    if (dbTransfers) {
      setTransfers((dbTransfers as any[]).map((t: any) => ({
        id: t.id, itemId: t.itemId || "", itemName: t.itemName || "",
        fromDept: t.fromDept || "Store", toDept: t.toDept || "Pharmacy",
        quantity: t.quantity || 0, transferDate: t.transferDate || "",
        transferredBy: t.transferredBy || "", status: t.status || "Completed",
        notes: t.notes || "",
      })));
    }
  }, [dbTransfers]);

  useEffect(() => {
    if (dbLabCatalog) {
      const defaults = ["Blood", "Urine", "Radiology", "Serology"];
      const allTests = (dbLabCatalog as any[]).filter((t: any) => !t.name?.startsWith("__placeholder_"));
      setLabTests(allTests.map((t: any) => ({
        id: t.id, name: t.name, category: t.category || "Blood",
        price: t.price || 0,
        parameters: (t.parameters || []).map((p: any) => ({
          name: p.name, unit: p.unit || "", normalRange: p.normalRange || "",
        })),
      })));
      // Sync custom categories from DB (including placeholder categories)
      const dbCategories = (dbLabCatalog as any[]).map((t: any) => t.category).filter(Boolean);
      const newCustom = dbCategories.filter((c: string) => !defaults.includes(c));
      setLabCustomCategories((prev) => Array.from(new Set([...prev, ...newCustom])));
    }
  }, [dbLabCatalog]);

  // Stock filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");

  // Assets
  const [assets, setAssets] = useState<HospitalAsset[]>(mockAssets);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCatFilter, setAssetCatFilter] = useState("all");
  const [assetStatusFilter, setAssetStatusFilter] = useState("all");
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [editAsset, setEditAsset] = useState<HospitalAsset | null>(null);
  const [assetForm, setAssetForm] = useState<Partial<HospitalAsset>>({});

  // Dialogs
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");

  // Transfer form
  const [tfItemId, setTfItemId] = useState("");
  const [tfFrom, setTfFrom] = useState<Department>("Store");
  const [tfTo, setTfTo] = useState<Department>("Pharmacy");
  const [tfQty, setTfQty] = useState(1);
  const [tfNotes, setTfNotes] = useState("");

  // Add/Edit form
  const [formData, setFormData] = useState<Partial<InventoryItem>>({});

  // Lab test management
  const [showAddTest, setShowAddTest] = useState(false);
  const [editTest, setEditTest] = useState<LabTestDefinition | null>(null);
  const [testForm, setTestForm] = useState({ name: "", category: "Blood" as string, price: 0, parameters: "" });
  const [editParams, setEditParams] = useState<{ name: string; unit: string; normalRange: string }[]>([]);
  const [compositeSearch, setCompositeSearch] = useState("");
  const [selectedChildTests, setSelectedChildTests] = useState<{ id: string; name: string; price: number }[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [showAddLabCategory, setShowAddLabCategory] = useState(false);
  const [newLabCategory, setNewLabCategory] = useState("");
  const [editLabCategory, setEditLabCategory] = useState<{ old: string; new: string } | null>(null);

  // Pharma filters
  const [pharmaSearch, setPharmaSearch] = useState("");

  // Ward CRUD
  const [showWardDialog, setShowWardDialog] = useState(false);
  const [wardEditId, setWardEditId] = useState<string | null>(null);
  const [wardForm, setWardForm] = useState<{ name: string; department: Department; totalBeds: number; chargePerDay: number }>({ name: "", department: "Ward A", totalBeds: 10, chargePerDay: 500 });

  // Report tab
  const [reportType, setReportType] = useState("summary");

  // Pharma filtered inventory
  const pharmaInventory = useMemo(() => {
    return inventory.filter((item) => {
      const isPharma = item.department === "Pharmacy" || item.category === "Medicine";
      const matchSearch = !pharmaSearch ||
        item.name.toLowerCase().includes(pharmaSearch.toLowerCase()) ||
        item.sku.toLowerCase().includes(pharmaSearch.toLowerCase());
      return isPharma && matchSearch;
    });
  }, [inventory, pharmaSearch]);

  const allLabCategories = useMemo(() => {
    const defaults = ["Blood", "Urine", "Radiology", "Serology"];
    const fromDb = labTests.map((t) => t.category);
    return Array.from(new Set([...defaults, ...labCustomCategories, ...fromDb])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [labCustomCategories, labTests]);

  const catalogSearchResults = useMemo(() => {
    const query = compositeSearch.trim().toLowerCase();

    if (query.length < 3) return [];

    return labTests
      .filter((test) => {
        if (selectedChildTests.some((selected) => selected.id === test.id)) return false;

        return test.name.toLowerCase().includes(query);
      })
      .slice(0, 30);
  }, [compositeSearch, labTests, selectedChildTests]);

  // ──── Filtered Inventory ────
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode.includes(searchQuery) ||
        item.batchNo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === "all" || item.category === categoryFilter;
      const matchDept = deptFilter === "all" || item.department === deptFilter;
      const matchStock = stockFilter === "all" ||
        (stockFilter === "low" && item.stock <= item.minStock && item.stock > 0) ||
        (stockFilter === "out" && item.stock === 0) ||
        (stockFilter === "expiring" && item.expiryDate && getExpiryStatus(item.expiryDate).label.includes("d left"));
      return matchSearch && matchCat && matchDept && matchStock;
    });
  }, [inventory, searchQuery, categoryFilter, deptFilter, stockFilter]);

  // ──── Stats ────
  const totalItems = inventory.length;
  const lowStockCount = inventory.filter((i) => i.stock > 0 && i.stock <= i.minStock).length;
  const outOfStockCount = inventory.filter((i) => i.stock === 0).length;
  const expiringCount = inventory.filter((i) => {
    if (!i.expiryDate) return false;
    const diff = new Date(i.expiryDate).getTime() - Date.now();
    return diff > 0 && diff <= 90 * 24 * 60 * 60 * 1000;
  }).length;
  const totalValue = inventory.reduce((s, i) => s + i.unitPrice * i.stock, 0);

  // ──── Handlers ────
  const handleEditItem = (item: InventoryItem) => {
    setEditItem(item);
    setFormData({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editItem) return;
    setInventory((prev) => prev.map((i) => i.id === editItem.id ? { ...i, ...formData, lastUpdated: format(new Date(), "yyyy-MM-dd") } as InventoryItem : i));
    toast.success(`${formData.name} updated`);
    setEditItem(null);
    setFormData({});
  };

  const handleAddItem = () => {
    setShowAddItem(true);
    setFormData({
      category: "Medicine", department: "Store", unit: "Piece", gstPercent: 12, stock: 0, minStock: 10, consumptionRate: 0,
    });
  };

  const handleSaveNewItem = () => {
    if (!formData.name || !formData.sku) { toast.error("Name and SKU required"); return; }
    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: formData.name || "",
      category: (formData.category as InventoryCategory) || "Medicine",
      sku: formData.sku || "",
      batchNo: formData.batchNo || "",
      manufacturer: formData.manufacturer || "",
      unitPrice: formData.unitPrice || 0,
      sellingPrice: formData.sellingPrice || 0,
      stock: formData.stock || 0,
      minStock: formData.minStock || 10,
      unit: formData.unit || "Piece",
      hsnCode: formData.hsnCode || "",
      gstPercent: formData.gstPercent || 12,
      expiryDate: formData.expiryDate,
      department: (formData.department as Department) || "Store",
      barcode: formData.barcode || `${Date.now()}`,
      lastUpdated: format(new Date(), "yyyy-MM-dd"),
      vendor: formData.vendor || "",
      purchaseDate: formData.purchaseDate || format(new Date(), "yyyy-MM-dd"),
      consumptionRate: formData.consumptionRate || 0,
    };
    setInventory((prev) => [...prev, newItem]);
    toast.success(`${newItem.name} added to inventory`);
    setShowAddItem(false);
    setFormData({});
  };

  const handleDeleteItem = (id: string) => {
    setInventory((prev) => prev.filter((i) => i.id !== id));
    toast.success("Item removed");
  };

  const handleCreateTransfer = () => {
    if (!tfItemId || tfQty <= 0) { toast.error("Select item and quantity"); return; }
    if (tfFrom === tfTo) { toast.error("Source and destination must differ"); return; }
    const item = inventory.find((i) => i.id === tfItemId);
    if (!item) return;
    if (tfQty > item.stock) { toast.error("Insufficient stock"); return; }
    const tf: StockTransfer = {
      id: `tr-${Date.now()}`,
      itemId: tfItemId,
      itemName: item.name,
      fromDept: tfFrom,
      toDept: tfTo,
      quantity: tfQty,
      transferDate: format(new Date(), "yyyy-MM-dd hh:mm a"),
      transferredBy: "Current User",
      status: "Pending",
      notes: tfNotes,
    };
    setTransfers((prev) => [tf, ...prev]);
    toast.success(`Transfer created: ${item.name} → ${tfTo}`);
    setShowTransferDialog(false);
    setTfItemId(""); setTfQty(1); setTfNotes("");
  };

  const handleApproveTransfer = (trId: string) => {
    const tf = transfers.find((t) => t.id === trId);
    if (!tf) return;
    setTransfers((prev) => prev.map((t) => t.id === trId ? { ...t, status: "Completed" as const } : t));
    setInventory((prev) => prev.map((i) => i.id === tf.itemId ? { ...i, stock: Math.max(0, i.stock - tf.quantity) } : i));
    toast.success(`Transfer approved: ${tf.itemName} to ${tf.toDept}`);
  };

  const handleRejectTransfer = (trId: string) => {
    setTransfers((prev) => prev.map((t) => t.id === trId ? { ...t, status: "Rejected" as const } : t));
    toast.info("Transfer rejected");
  };

  const handleBarcodeScan = () => {
    const found = inventory.find((i) => i.barcode === barcodeInput || i.sku === barcodeInput);
    if (found) {
      setSearchQuery(found.barcode);
      setShowBarcodeScanner(false);
      setBarcodeInput("");
      toast.success(`Found: ${found.name}`);
    } else {
      toast.error("Item not found");
    }
  };

  // Lab test handlers — persisted to DB
  const handleAddTest = async () => {
    if (!testForm.name.trim()) { toast.error("Test name required"); return; }
    const hasChildren = selectedChildTests.length > 0;

    // If sub-tests selected, aggregate their parameters automatically
    let params: { name: string; unit: string; normal_range: string }[] = [];
    if (hasChildren) {
      // Fetch parameters from each selected child test
      for (const ct of selectedChildTests) {
        const catalogTest = labTests.find((t) => t.id === ct.id);
        if (catalogTest?.parameters) {
          params.push(...catalogTest.parameters.map((p) => ({
            name: selectedChildTests.length > 1 ? `${ct.name} - ${p.name}` : p.name,
            unit: p.unit || "",
            normal_range: p.normalRange || "",
          })));
        }
      }
    } else {
      // Manual parameters entry
      params = testForm.parameters.split(",").map((p) => p.trim()).filter(Boolean).map((p) => ({ name: p, unit: "", normal_range: "" }));
    }

    const totalPrice = hasChildren
      ? selectedChildTests.reduce((s, t) => s + t.price, 0)
      : testForm.price;

    createTestMutation.mutate({
      item: { name: testForm.name.trim(), category: testForm.category as any, price: totalPrice },
      parameters: params,
    }, {
      onSuccess: async (created: any) => {
        // Save composite_test_items if multiple sub-tests
        if (hasChildren && created?.id) {
          const rows = selectedChildTests.map((ct) => ({ parent_test_id: created.id, child_test_id: ct.id }));
          await supabase.from("composite_test_items" as any).insert(rows);
        }
        toast.success(`Test "${testForm.name}" added`);
        resetTestDialog();
      },
      onError: (err: any) => toast.error(err.message || "Failed to add test"),
    });
  };

  const handleEditTest = (test: LabTestDefinition) => {
    setEditTest(test);
    setTestForm({
      name: test.name,
      category: test.category,
      price: test.price,
      parameters: "",
    });
    setEditParams(test.parameters.map((p) => ({ name: p.name, unit: p.unit || "", normalRange: p.normalRange || "" })));
  };

  const handleSaveEditTest = () => {
    if (!editTest || !testForm.name) { toast.error("Test name required"); return; }
    const params = editParams.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), unit: p.unit.trim(), normal_range: p.normalRange.trim() }));
    updateTestMutation.mutate({
      id: editTest.id,
      updates: { name: testForm.name, category: testForm.category as any, price: testForm.price },
      parameters: params.length > 0 ? params : undefined,
    }, {
      onSuccess: () => {
        toast.success(`Test "${testForm.name}" updated`);
        setEditTest(null);
        setEditParams([]);
        setTestForm({ name: "", category: "Blood", price: 0, parameters: "" });
      },
      onError: (err: any) => toast.error(err.message || "Failed to update test"),
    });
  };

  const handleRemoveTest = (testId: string) => {
    deleteTestMutation.mutate(testId, {
      onSuccess: () => toast.success("Test removed"),
      onError: (err: any) => toast.error(err.message || "Failed to delete test"),
    });
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (customCategories.includes(newCategory) || inventoryCategories.includes(newCategory as InventoryCategory)) {
      toast.error("Category already exists"); return;
    }
    setCustomCategories((prev) => [...prev, newCategory.trim()]);
    toast.success(`Category "${newCategory}" added`);
    setNewCategory("");
    setShowAddCategory(false);
  };

  const handleAddLabCategory = async () => {
    if (!newLabCategory.trim()) return;
    const allExisting = allLabCategories;
    if (allExisting.includes(newLabCategory.trim())) { toast.error("Category already exists"); return; }
    // Create a placeholder test in DB so the category persists
    try {
      await createTestMutation.mutateAsync({
        item: { name: `__placeholder_${newLabCategory.trim()}__`, category: newLabCategory.trim() as any, price: 0 },
        parameters: [],
      });
      toast.success(`Lab category "${newLabCategory}" added`);
    } catch (err: any) {
      // Even if DB fails, add locally
      setLabCustomCategories((prev) => [...prev, newLabCategory.trim()]);
      toast.success(`Lab category "${newLabCategory}" added locally`);
    }
    setNewLabCategory("");
    setShowAddLabCategory(false);
  };

  const handleEditLabCategory = () => {
    if (!editLabCategory || !editLabCategory.new.trim()) return;
    // Rename in custom categories
    setLabCustomCategories((prev) => prev.map((c) => c === editLabCategory.old ? editLabCategory.new.trim() : c));
    // Update tests with old category name
    setLabTests((prev) => prev.map((t) => t.category === editLabCategory.old ? { ...t, category: editLabCategory.new.trim() as LabCategory } : t));
    toast.success(`Category renamed to "${editLabCategory.new}"`);
    setEditLabCategory(null);
  };

  const handleRemoveLabCategory = (cat: string) => {
    const testsInCat = labTests.filter((t) => t.category === cat);
    if (testsInCat.length > 0) { toast.error(`Cannot remove — ${testsInCat.length} tests in this category`); return; }
    setLabCustomCategories((prev) => prev.filter((c) => c !== cat));
    toast.success(`Category "${cat}" removed`);
  };

  const resetTestDialog = () => {
    setShowAddTest(false);
    setEditTest(null);
    setTestForm({ name: "", category: allLabCategories[0] || "Blood", price: 0, parameters: "" });
    setEditParams([]);
    setSelectedChildTests([]);
    setCompositeSearch("");
  };

  const handleSelectCatalogTest = (test: LabTestDefinition) => {
    if (selectedChildTests.some((selected) => selected.id === test.id)) return;

    const nextSelectedTests = [...selectedChildTests, { id: test.id, name: test.name, price: test.price, category: test.category }];
    setSelectedChildTests(nextSelectedTests);

    // Auto-calculate total price and aggregate category from first test
    const totalPrice = nextSelectedTests.reduce((sum, t) => sum + t.price, 0);
    setTestForm((prev) => ({
      ...prev,
      category: prev.category || test.category,
      price: totalPrice,
      parameters: "", // parameters auto-fetched from sub-tests, no manual entry needed
    }));

    setCompositeSearch("");
  };

  const allCategories = [...inventoryCategories, ...customCategories];

  // ──── Report Data ────
  const reportData = useMemo(() => {
    const byCat = inventoryCategories.map((c) => {
      const items = inventory.filter((i) => i.category === c);
      return { category: c, count: items.length, value: items.reduce((s, i) => s + i.unitPrice * i.stock, 0), stock: items.reduce((s, i) => s + i.stock, 0) };
    });
    const byDept = departments.map((d) => {
      const items = inventory.filter((i) => i.department === d);
      return { department: d, count: items.length, value: items.reduce((s, i) => s + i.unitPrice * i.stock, 0) };
    });
    const fastMoving = [...inventory].filter((i) => i.consumptionRate > 0).sort((a, b) => b.consumptionRate - a.consumptionRate).slice(0, 10);
    const slowMoving = [...inventory].filter((i) => i.consumptionRate > 0).sort((a, b) => a.consumptionRate - b.consumptionRate).slice(0, 10);
    const deadStock = inventory.filter((i) => i.consumptionRate === 0 && i.category !== "Equipment");
    const expiryItems = inventory.filter((i) => i.expiryDate).sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());
    return { byCat, byDept, fastMoving, slowMoving, deadStock, expiryItems };
  }, [inventory]);

  // ──── Asset Handlers ────
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchSearch = !assetSearch ||
        a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.assetTag.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.serialNo.toLowerCase().includes(assetSearch.toLowerCase());
      const matchCat = assetCatFilter === "all" || a.category === assetCatFilter;
      const matchStatus = assetStatusFilter === "all" || a.status === assetStatusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [assets, assetSearch, assetCatFilter, assetStatusFilter]);

  const totalAssetValue = assets.reduce((s, a) => s + a.purchaseCost, 0);
  const maintenanceDue = assets.filter((a) => {
    if (!a.nextMaintenanceDate) return false;
    return new Date(a.nextMaintenanceDate).getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  const handleOpenAddAsset = () => {
    setShowAddAsset(true);
    setAssetForm({ category: "Medical Equipment", department: "Store", status: "Active", condition: "Good", purchaseDate: format(new Date(), "yyyy-MM-dd") });
  };
  const handleOpenEditAsset = (asset: HospitalAsset) => {
    setEditAsset(asset);
    setAssetForm({ ...asset });
  };
  const handleSaveAsset = () => {
    if (!assetForm.name || !assetForm.assetTag) { toast.error("Name and Asset Tag required"); return; }
    if (editAsset) {
      setAssets((prev) => prev.map((a) => a.id === editAsset.id ? { ...a, ...assetForm } as HospitalAsset : a));
      toast.success(`${assetForm.name} updated`);
      setEditAsset(null);
    } else {
      const newAsset: HospitalAsset = {
        id: `ast-${Date.now()}`, name: assetForm.name || "", assetTag: assetForm.assetTag || "",
        category: assetForm.category || "Medical Equipment", department: (assetForm.department as Department) || "Store",
        location: assetForm.location || "", manufacturer: assetForm.manufacturer || "", model: assetForm.model || "",
        serialNo: assetForm.serialNo || "", purchaseDate: assetForm.purchaseDate || format(new Date(), "yyyy-MM-dd"),
        purchaseCost: assetForm.purchaseCost || 0, warrantyExpiry: assetForm.warrantyExpiry,
        status: (assetForm.status as AssetStatus) || "Active", condition: (assetForm.condition as AssetCondition) || "Good",
        lastMaintenanceDate: assetForm.lastMaintenanceDate, nextMaintenanceDate: assetForm.nextMaintenanceDate,
        assignedTo: assetForm.assignedTo, notes: assetForm.notes,
      };
      setAssets((prev) => [...prev, newAsset]);
      toast.success(`${newAsset.name} added`);
      setShowAddAsset(false);
    }
    setAssetForm({});
  };
  const handleDeleteAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    toast.success("Asset removed");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Inventory Management
          </h1>
          <p className="text-sm text-muted-foreground">Manage hospital stock, transfers, and reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBarcodeScanner(true)}>
            <QrCode className="h-4 w-4 mr-1" /> Scan
          </Button>
          <Button size="sm" onClick={handleAddItem}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Items" value={totalItems} icon={<Package className="h-4 w-4" />} accent="text-primary" />
        <StatCard label="Total Value" value={`₹${(totalValue / 1000).toFixed(0)}K`} icon={<IndianRupee className="h-4 w-4" />} accent="text-info" />
        <StatCard label="Low Stock" value={lowStockCount} icon={<AlertTriangle className="h-4 w-4" />} accent="text-warning" />
        <StatCard label="Out of Stock" value={outOfStockCount} icon={<XCircle className="h-4 w-4" />} accent="text-destructive" />
        <StatCard label="Expiring Soon" value={expiringCount} icon={<Clock className="h-4 w-4" />} accent="text-warning" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="stock"><Package className="h-4 w-4 mr-1" /> Stock</TabsTrigger>
          <TabsTrigger value="pharma"><IndianRupee className="h-4 w-4 mr-1" /> Pharma</TabsTrigger>
          <TabsTrigger value="diagnostics"><Scan className="h-4 w-4 mr-1" /> Diagnostics</TabsTrigger>
          <TabsTrigger value="transfers"><ArrowLeftRight className="h-4 w-4 mr-1" /> Transfers</TabsTrigger>
          <TabsTrigger value="beds-wards"><BedDouble className="h-4 w-4 mr-1" /> Beds & Wards</TabsTrigger>
          <TabsTrigger value="assets"><Landmark className="h-4 w-4 mr-1" /> Assets</TabsTrigger>
          <TabsTrigger value="reports"><BarChart3 className="h-4 w-4 mr-1" /> Reports</TabsTrigger>
        </TabsList>

        {/* ════════ STOCK TAB ════════ */}
        <TabsContent value="stock">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name, SKU, barcode, batch..." className="pl-9 h-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Stock" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowAddCategory(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Category
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Dept</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Price (₹)</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No items found</TableCell></TableRow>
                  ) : (
                    filteredInventory.map((item) => {
                      const expiry = getExpiryStatus(item.expiryDate);
                      const stockSt = getStockStatus(item.stock, item.minStock);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.sku} · {item.manufacturer}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px]", categoryColors[item.category as InventoryCategory] || "")}>
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.department}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium text-sm">{item.stock}</span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                          </TableCell>
                          <TableCell className="text-right text-sm">₹{item.sellingPrice}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.batchNo}</TableCell>
                          <TableCell>
                            {item.expiryDate ? (
                              <span className={cn("text-xs px-1.5 py-0.5 rounded", expiry.color)}>{expiry.label}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", stockSt.color)}>{stockSt.label}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(item)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ════════ PHARMA TAB ════════ */}
        <TabsContent value="pharma">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={pharmaSearch} onChange={(e) => setPharmaSearch(e.target.value)} placeholder="Search pharma stock..." className="pl-9 h-9" />
            </div>
            <Button size="sm" onClick={() => { setShowAddItem(true); setFormData({ category: "Medicine", department: "Pharmacy", unit: "Strip (10)", gstPercent: 12, stock: 0, minStock: 10, consumptionRate: 0 }); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Medicine
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Unit Price (₹)</TableHead>
                    <TableHead className="text-right">Selling Price (₹)</TableHead>
                    <TableHead className="text-right">GST %</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pharmaInventory.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No pharma items found</TableCell></TableRow>
                  ) : (
                    pharmaInventory.map((item) => {
                      const expiry = getExpiryStatus(item.expiryDate);
                      const stockSt = getStockStatus(item.stock, item.minStock);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.sku} · {item.manufacturer}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.batchNo}</TableCell>
                          <TableCell className="text-right text-sm">₹{item.unitPrice}</TableCell>
                          <TableCell className="text-right text-sm font-medium">₹{item.sellingPrice}</TableCell>
                          <TableCell className="text-right text-xs">{item.gstPercent}%</TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium text-sm">{item.stock}</span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                          </TableCell>
                          <TableCell>
                            {item.expiryDate ? (
                              <span className={cn("text-xs px-1.5 py-0.5 rounded", expiry.color)}>{expiry.label}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", stockSt.color)}>{stockSt.label}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(item)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ════════ DIAGNOSTICS TAB ════════ */}
        <TabsContent value="diagnostics">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">Manage lab test catalog — add/edit/remove tests and categories</p>
              {labTests.length > 0 && <Badge variant="secondary" className="text-xs">{labTests.length} tests loaded</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddLabCategory(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Category
              </Button>
              <Button size="sm" onClick={() => { setEditTest(null); setTestForm({ name: "", category: allLabCategories[0] || "Blood", price: 0, parameters: "" }); setSelectedChildTests([]); setCompositeSearch(""); setShowAddTest(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Test
              </Button>
            </div>
          </div>

          {/* Category management chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {allLabCategories.map((cat) => {
              const isCustom = labCustomCategories.includes(cat);
              return (
                <Badge key={cat} variant="outline" className="text-xs py-1 px-2 gap-1.5">
                  {cat} ({labTests.filter((t) => t.category === cat).length})
                  {isCustom && (
                    <>
                      <button onClick={() => setEditLabCategory({ old: cat, new: cat })} className="hover:text-primary"><Edit className="h-3 w-3" /></button>
                      <button onClick={() => handleRemoveLabCategory(cat)} className="hover:text-destructive"><XCircle className="h-3 w-3" /></button>
                    </>
                  )}
                </Badge>
              );
            })}
          </div>

          {labTests.length === 0 && !dbLabCatalog && (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading lab test catalog...</p>
          )}
          {labTests.length === 0 && dbLabCatalog && (
            <p className="text-sm text-muted-foreground py-8 text-center">No lab tests found. Add tests using the "Add Test" button above.</p>
          )}

          {allLabCategories.map((cat) => {
            const tests = labTests.filter((t) => t.category === cat);
            if (tests.length === 0) return null;
            return (
              <div key={cat} className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  {cat === "Blood" && "🩸"}{cat === "Urine" && "🧪"}{cat === "Radiology" && "📷"}{cat === "Serology" && "🔬"}
                  {cat} Tests ({tests.length})
                </h3>
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test Name</TableHead>
                        <TableHead>Parameters</TableHead>
                        <TableHead className="text-right">Price (₹)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tests.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium text-sm">{t.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.parameters.length > 0 ? (
                              <div className="space-y-0.5">
                                {t.parameters.map((p, i) => (
                                  <div key={i}>
                                    <span className="font-medium text-foreground/80">{p.name}</span>
                                    {p.unit && <span className="ml-1">({p.unit})</span>}
                                    {p.normalRange && <span className="ml-1 text-muted-foreground">Normal: {p.normalRange}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">₹{t.price}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditTest(t)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveTest(t.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ════════ TRANSFERS TAB ════════ */}
        <TabsContent value="transfers">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">Pending: {transfers.filter((t) => t.status === "Pending").length}</Badge>
              <Badge variant="outline" className="text-xs text-success">Completed: {transfers.filter((t) => t.status === "Completed").length}</Badge>
            </div>
            <Button size="sm" onClick={() => setShowTransferDialog(true)}>
              <ArrowLeftRight className="h-4 w-4 mr-1" /> New Transfer
            </Button>
          </div>

          {/* Quick Transfer Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Store → Pharmacy", from: "Store" as Department, to: "Pharmacy" as Department },
              { label: "Store → ICU", from: "Store" as Department, to: "ICU" as Department },
              { label: "Store → OT", from: "Store" as Department, to: "OT" as Department },
              { label: "Inter-Dept", from: "Store" as Department, to: "Ward A" as Department },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => { setShowTransferDialog(true); setTfFrom(preset.from); setTfTo(preset.to); }}
                className="rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 transition-all"
              >
                <ArrowLeftRight className="h-4 w-4 text-primary mb-1" />
                <p className="text-sm font-medium text-foreground">{preset.label}</p>
              </button>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((tf) => (
                  <TableRow key={tf.id}>
                    <TableCell className="font-medium text-sm">{tf.itemName}</TableCell>
                    <TableCell className="text-xs">{tf.fromDept} → {tf.toDept}</TableCell>
                    <TableCell className="text-right text-sm">{tf.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tf.transferDate}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tf.transferredBy}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]",
                        tf.status === "Completed" && "text-success bg-success/10",
                        tf.status === "Pending" && "text-warning bg-warning/10",
                        tf.status === "Rejected" && "text-destructive bg-destructive/10",
                      )}>{tf.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {tf.status === "Pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => handleApproveTransfer(tf.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRejectTransfer(tf.id)}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ════════ BEDS & WARDS TAB ════════ */}
        <TabsContent value="beds-wards">
          {(() => {
            const bedItems = inventory.filter((i) => i.category === "Beds");
            const wardItems = wardInventoryItems;
            const totalBedStock = bedItems.reduce((s, i) => s + i.stock, 0);
            const totalBedValue = bedItems.reduce((s, i) => s + i.unitPrice * i.stock, 0);
            return (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-info/10 text-info"><BedDouble className="h-5 w-5" /></div>
                    <div><p className="text-xs text-muted-foreground">Total Bed Types</p><p className="text-lg font-bold text-foreground">{bedItems.length}</p></div>
                  </div>
                  <div className="rounded-lg border border-border p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10 text-success"><CheckCircle2 className="h-5 w-5" /></div>
                    <div><p className="text-xs text-muted-foreground">Total Bed Units</p><p className="text-lg font-bold text-foreground">{totalBedStock}</p></div>
                  </div>
                  <div className="rounded-lg border border-border p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
                    <div><p className="text-xs text-muted-foreground">Total Wards</p><p className="text-lg font-bold text-foreground">{wardItems.length}</p></div>
                  </div>
                  <div className="rounded-lg border border-border p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/10 text-warning"><IndianRupee className="h-5 w-5" /></div>
                    <div><p className="text-xs text-muted-foreground">Bed Asset Value</p><p className="text-lg font-bold text-foreground">₹{(totalBedValue / 100000).toFixed(1)}L</p></div>
                  </div>
                </div>

                {/* Beds Section */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><BedDouble className="h-4 w-4 text-info" /> Bed Inventory</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bedItems.map((bed) => {
                      const isMaintenanceMode = bed.stock === 0 && bed.name.includes("(Maintenance)");
                      return (
                        <div key={bed.id} className={cn("rounded-xl border bg-card p-4 hover:shadow-md transition-shadow", isMaintenanceMode ? "border-warning/40 bg-warning/5" : "border-border")}>
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="text-sm font-bold text-foreground">{bed.name}</h4>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] bg-info/10 text-info border-info/20">{bed.sku}</Badge>
                            </div>
                          </div>
                          <div className="space-y-1.5 text-xs text-muted-foreground">
                            <div className="flex justify-between"><span>Manufacturer</span><span className="text-foreground font-medium">{bed.manufacturer}</span></div>
                            <div className="flex justify-between"><span>Stock</span><span className="text-foreground font-bold">{bed.stock} units</span></div>
                            <div className="flex justify-between"><span>Unit Price</span><span className="text-foreground">₹{bed.unitPrice.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>Department</span><span className="text-foreground">{bed.department}</span></div>
                            <div className="flex justify-between"><span>Last Updated</span><span>{bed.lastUpdated}</span></div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-border flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs flex-1"
                              onClick={() => {
                                setInventory((prev) => prev.map((i) => {
                                  if (i.id !== bed.id) return i;
                                  const goingToMaintenance = i.stock > 0;
                                  return {
                                    ...i,
                                    stock: goingToMaintenance ? 0 : bed.minStock || 1,
                                    lastUpdated: format(new Date(), "yyyy-MM-dd"),
                                  };
                                }));
                                toast.success(bed.stock > 0 ? `${bed.name} set to maintenance` : `${bed.name} restored from maintenance`);
                              }}
                            >
                              <Wrench className="h-3 w-3 mr-1" />
                              {bed.stock === 0 ? "Restore" : "Maintenance"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Wards Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Ward Configuration</h3>
                    <Button size="sm" className="h-8" onClick={() => { setShowWardDialog(true); setWardEditId(null); setWardForm({ name: "", department: "Ward A" as Department, totalBeds: 10, chargePerDay: 500 }); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Ward
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Ward Name</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Total Beds</TableHead>
                          <TableHead>Charge/Day</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wardItems.map((ward) => (
                          <TableRow key={ward.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{ward.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{ward.sku}</TableCell>
                            <TableCell className="text-sm">{ward.department}</TableCell>
                            <TableCell className="font-bold">{ward.stock}</TableCell>
                            <TableCell className="text-sm">₹{ward.sellingPrice.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{ward.lastUpdated}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                  setWardEditId(ward.id);
                                  setWardForm({ name: ward.name, department: ward.department, totalBeds: ward.stock, chargePerDay: ward.sellingPrice });
                                  setShowWardDialog(true);
                                }}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                                  deleteWard(ward.id);
                                  toast.success(`${ward.name} removed`);
                                }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            );
          })()}
        </TabsContent>

        {/* ════════ REPORTS TAB ════════ */}
        <TabsContent value="reports">
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { id: "summary", label: "Stock Summary" },
              { id: "batch", label: "Batchwise" },
              { id: "expiry", label: "Expiry Report" },
              { id: "fast", label: "Fast Moving" },
              { id: "slow", label: "Slow Moving" },
              { id: "dead", label: "Dead Stock" },
              { id: "purchase", label: "Purchase vs Consumption" },
              { id: "deptwise", label: "Dept-wise Usage" },
            ].map((r) => (
              <Button key={r.id} variant={reportType === r.id ? "default" : "outline"} size="sm" onClick={() => setReportType(r.id)}>
                {r.label}
              </Button>
            ))}
          </div>

          {reportType === "summary" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Total Stock</TableHead><TableHead className="text-right">Value (₹)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reportData.byCat.map((r) => (
                    <TableRow key={r.category}>
                      <TableCell className="font-medium text-sm">{r.category}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right">{r.stock.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{r.value.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/30">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totalItems}</TableCell>
                    <TableCell className="text-right">{inventory.reduce((s, i) => s + i.stock, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">₹{totalValue.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {reportType === "batch" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Batch No</TableHead><TableHead>Manufacturer</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Expiry</TableHead><TableHead>Vendor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {inventory.sort((a, b) => a.name.localeCompare(b.name)).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium text-sm">{i.name}</TableCell>
                      <TableCell className="text-xs">{i.batchNo}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.manufacturer}</TableCell>
                      <TableCell className="text-right">{i.stock}</TableCell>
                      <TableCell><span className={cn("text-xs px-1 py-0.5 rounded", getExpiryStatus(i.expiryDate).color)}>{i.expiryDate || "N/A"}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.vendor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {reportType === "expiry" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Batch</TableHead><TableHead>Expiry Date</TableHead><TableHead>Days Left</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Value (₹)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reportData.expiryItems.map((i) => {
                    const exp = getExpiryStatus(i.expiryDate);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium text-sm">{i.name}</TableCell>
                        <TableCell className="text-xs">{i.batchNo}</TableCell>
                        <TableCell className="text-sm">{i.expiryDate}</TableCell>
                        <TableCell><span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", exp.color)}>{exp.label}</span></TableCell>
                        <TableCell className="text-right">{i.stock}</TableCell>
                        <TableCell className="text-right">₹{(i.unitPrice * i.stock).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {reportType === "fast" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Consumption/mo</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Months Left</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reportData.fastMoving.map((i, idx) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{i.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{i.category}</Badge></TableCell>
                      <TableCell className="text-right"><span className="flex items-center justify-end gap-1"><TrendingUp className="h-3 w-3 text-success" />{i.consumptionRate}</span></TableCell>
                      <TableCell className="text-right">{i.stock}</TableCell>
                      <TableCell><span className={cn("text-xs", i.consumptionRate > 0 && i.stock / i.consumptionRate < 2 ? "text-destructive" : "text-muted-foreground")}>{i.consumptionRate > 0 ? (i.stock / i.consumptionRate).toFixed(1) : "∞"}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {reportType === "slow" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Consumption/mo</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Months Left</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reportData.slowMoving.map((i, idx) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{i.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{i.category}</Badge></TableCell>
                      <TableCell className="text-right"><span className="flex items-center justify-end gap-1"><TrendingDown className="h-3 w-3 text-warning" />{i.consumptionRate}</span></TableCell>
                      <TableCell className="text-right">{i.stock}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.consumptionRate > 0 ? (i.stock / i.consumptionRate).toFixed(1) : "∞"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {reportType === "dead" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {reportData.deadStock.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No dead stock items</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Dept</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Value (₹)</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reportData.deadStock.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium text-sm">{i.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{i.category}</Badge></TableCell>
                        <TableCell className="text-xs">{i.department}</TableCell>
                        <TableCell className="text-right">{i.stock}</TableCell>
                        <TableCell className="text-right">₹{(i.unitPrice * i.stock).toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{i.lastUpdated}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {reportType === "purchase" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Purchase Price</TableHead><TableHead className="text-right">Selling Price</TableHead><TableHead className="text-right">Monthly Usage</TableHead><TableHead className="text-right">Monthly Cost</TableHead><TableHead className="text-right">Monthly Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {inventory.filter((i) => i.consumptionRate > 0).sort((a, b) => b.consumptionRate * b.sellingPrice - a.consumptionRate * a.sellingPrice).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium text-sm">{i.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{i.category}</Badge></TableCell>
                      <TableCell className="text-right">₹{i.unitPrice}</TableCell>
                      <TableCell className="text-right">₹{i.sellingPrice}</TableCell>
                      <TableCell className="text-right">{i.consumptionRate}</TableCell>
                      <TableCell className="text-right">₹{(i.unitPrice * i.consumptionRate).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">₹{(i.sellingPrice * i.consumptionRate).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {reportType === "deptwise" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Department</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Total Value (₹)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reportData.byDept.filter((d) => d.count > 0).map((d) => (
                    <TableRow key={d.department}>
                      <TableCell className="font-medium text-sm flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{d.department}</TableCell>
                      <TableCell className="text-right">{d.count}</TableCell>
                      <TableCell className="text-right">₹{d.value.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ════════ ASSETS TAB ════════ */}
        <TabsContent value="assets">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder="Search name, tag, serial..." className="pl-9 h-9" />
            </div>
            <Select value={assetCatFilter} onValueChange={setAssetCatFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {assetCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assetStatusFilter} onValueChange={setAssetStatusFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {assetStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleOpenAddAsset}><Plus className="h-4 w-4 mr-1" /> Add Asset</Button>
          </div>

          {/* Asset Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Total Assets" value={assets.length} icon={<Landmark className="h-4 w-4" />} accent="text-primary" />
            <StatCard label="Asset Value" value={`₹${(totalAssetValue / 100000).toFixed(1)}L`} icon={<IndianRupee className="h-4 w-4" />} accent="text-info" />
            <StatCard label="Active" value={assets.filter((a) => a.status === "Active").length} icon={<CheckCircle2 className="h-4 w-4" />} accent="text-success" />
            <StatCard label="Maintenance Due" value={maintenanceDue} icon={<Wrench className="h-4 w-4" />} accent="text-warning" />
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead>Next Maintenance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No assets found</TableCell></TableRow>
                ) : filteredAssets.map((asset) => {
                  const warrantyOk = asset.warrantyExpiry ? new Date(asset.warrantyExpiry) > new Date() : false;
                  const maintDue = asset.nextMaintenanceDate ? new Date(asset.nextMaintenanceDate).getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000 : false;
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-mono text-xs">{asset.assetTag}</TableCell>
                      <TableCell className="font-medium">{asset.name}<br /><span className="text-xs text-muted-foreground">{asset.manufacturer} {asset.model}</span></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{asset.category}</Badge></TableCell>
                      <TableCell className="text-xs">{asset.department}</TableCell>
                      <TableCell className="text-xs">{asset.location}</TableCell>
                      <TableCell><Badge className={cn("text-xs", statusColors[asset.status])}>{asset.status}</Badge></TableCell>
                      <TableCell><Badge className={cn("text-xs", conditionColors[asset.condition])}>{asset.condition}</Badge></TableCell>
                      <TableCell className="text-xs">₹{asset.purchaseCost.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">
                        {asset.warrantyExpiry ? (
                          <span className={warrantyOk ? "text-success" : "text-destructive"}>{warrantyOk ? "Valid" : "Expired"} · {asset.warrantyExpiry}</span>
                        ) : <span className="text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {asset.nextMaintenanceDate ? (
                          <span className={maintDue ? "text-warning font-medium" : ""}>{asset.nextMaintenanceDate}{maintDue && " ⚠"}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditAsset(asset)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteAsset(asset.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>



      </Tabs>

      {/* ════════ DIALOGS ════════ */}

      {/* Add/Edit Item Dialog */}
      <Dialog open={!!editItem || showAddItem} onOpenChange={(open) => { if (!open) { setEditItem(null); setShowAddItem(false); setFormData({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Item" : "Add New Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Item Name *</Label>
              <Input value={formData.name || ""} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">SKU *</Label>
              <Input value={formData.sku || ""} onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Barcode</Label>
              <Input value={formData.barcode || ""} onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={formData.category || "Medicine"} onValueChange={(v) => setFormData((p) => ({ ...p, category: v as InventoryCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Department</Label>
              <Select value={formData.department || "Store"} onValueChange={(v) => setFormData((p) => ({ ...p, department: v as Department }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Batch No</Label>
              <Input value={formData.batchNo || ""} onChange={(e) => setFormData((p) => ({ ...p, batchNo: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Manufacturer</Label>
              <Input value={formData.manufacturer || ""} onChange={(e) => setFormData((p) => ({ ...p, manufacturer: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Unit Price (₹)</Label>
              <Input type="number" value={formData.unitPrice || 0} onChange={(e) => setFormData((p) => ({ ...p, unitPrice: +e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Selling Price (₹)</Label>
              <Input type="number" value={formData.sellingPrice || 0} onChange={(e) => setFormData((p) => ({ ...p, sellingPrice: +e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Stock Qty</Label>
              <Input type="number" value={formData.stock || 0} onChange={(e) => setFormData((p) => ({ ...p, stock: +e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Min Stock</Label>
              <Input type="number" value={formData.minStock || 0} onChange={(e) => setFormData((p) => ({ ...p, minStock: +e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Input value={formData.unit || ""} onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">HSN Code</Label>
              <Input value={formData.hsnCode || ""} onChange={(e) => setFormData((p) => ({ ...p, hsnCode: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">GST %</Label>
              <Input type="number" value={formData.gstPercent || 0} onChange={(e) => setFormData((p) => ({ ...p, gstPercent: +e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Expiry Date</Label>
              <Input type="date" value={formData.expiryDate || ""} onChange={(e) => setFormData((p) => ({ ...p, expiryDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Vendor</Label>
              <Input value={formData.vendor || ""} onChange={(e) => setFormData((p) => ({ ...p, vendor: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditItem(null); setShowAddItem(false); setFormData({}); }}>Cancel</Button>
            <Button onClick={editItem ? handleSaveEdit : handleSaveNewItem}>{editItem ? "Save Changes" : "Add Item"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Select Item</Label>
              <Select value={tfItemId} onValueChange={setTfItemId}>
                <SelectTrigger><SelectValue placeholder="Choose item..." /></SelectTrigger>
                <SelectContent>
                  {inventory.filter((i) => i.stock > 0).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Select value={tfFrom} onValueChange={(v) => setTfFrom(v as Department)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Select value={tfTo} onValueChange={(v) => setTfTo(v as Department)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min={1} value={tfQty} onChange={(e) => setTfQty(+e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={tfNotes} onChange={(e) => setTfNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTransfer}>Create Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <Dialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /> Barcode / QR Scan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-xl p-8 flex flex-col items-center justify-center border-2 border-dashed border-border">
              <Scan className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Scan barcode or enter manually</p>
            </div>
            <Input
              placeholder="Enter barcode or SKU..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeScan()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBarcodeScanner(false)}>Cancel</Button>
            <Button onClick={handleBarcodeScan}>Search</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Test Dialog */}
      <Dialog open={showAddTest || !!editTest} onOpenChange={(open) => { if (!open) resetTestDialog(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTest ? "Edit Diagnostic Test" : "Add Diagnostic Test"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Step 1: Test Name first */}
            <div>
              <Label className="text-xs">Test Name *</Label>
              <Input value={testForm.name} onChange={(e) => setTestForm((p) => ({ ...p, name: e.target.value }))} placeholder="Enter your test name" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={testForm.category} onValueChange={(v) => setTestForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allLabCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Search and add sub-tests */}
            {!editTest && (
              <div className="space-y-2">
                <Label className="text-xs">Add Tests (parameters & price auto-fetched)</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8" value={compositeSearch} onChange={(e) => setCompositeSearch(e.target.value)} placeholder="Search tests to include..." />
                </div>
                {catalogSearchResults.length > 0 && (
                  <div className="border border-border rounded-md max-h-48 overflow-y-auto bg-popover">
                    {catalogSearchResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectCatalogTest(t);
                        }}
                      >
                        <span>{t.name}</span>
                        <span className="text-xs text-muted-foreground">{t.category} · ₹{t.price}</span>
                      </button>
                    ))}
                  </div>
                )}
                {compositeSearch.trim().length >= 3 && catalogSearchResults.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground border border-border rounded-md">No matching tests</p>
                )}
                {selectedChildTests.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Included tests ({selectedChildTests.length})</Label>
                    {selectedChildTests.map((ct) => (
                      <div key={ct.id} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1">
                        <span className="text-xs">{ct.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">₹{ct.price}</span>
                          <button type="button" onClick={() => {
                            const newList = selectedChildTests.filter((t) => t.id !== ct.id);
                            setSelectedChildTests(newList);
                            const totalPrice = newList.reduce((sum, t) => sum + t.price, 0);
                            setTestForm((prev) => ({ ...prev, price: totalPrice }));
                          }} className="text-destructive hover:text-destructive/80">
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs font-medium mt-1">Total Price: ₹{selectedChildTests.reduce((s, t) => s + t.price, 0)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Price - auto-calculated but editable */}
            <div>
              <Label className="text-xs">Price (₹) {selectedChildTests.length > 0 && <span className="text-muted-foreground">— auto-calculated</span>}</Label>
              <Input type="number" value={testForm.price} onChange={(e) => setTestForm((p) => ({ ...p, price: +e.target.value }))} />
            </div>

            {/* Parameters only for edit mode or when no sub-tests selected */}
            {editTest && editParams.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Parameters</Label>
                <div className="border border-border rounded-md overflow-hidden">
                  <div className="grid grid-cols-[1fr_80px_100px_32px] gap-1 px-2 py-1 bg-muted/50 text-[10px] font-medium text-muted-foreground">
                    <span>Name</span><span>Unit</span><span>Normal Range</span><span></span>
                  </div>
                  {editParams.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-1 px-2 py-1 border-t border-border">
                      <Input className="h-7 text-xs" value={p.name} onChange={(e) => { const next = [...editParams]; next[i] = { ...next[i], name: e.target.value }; setEditParams(next); }} />
                      <Input className="h-7 text-xs" value={p.unit} onChange={(e) => { const next = [...editParams]; next[i] = { ...next[i], unit: e.target.value }; setEditParams(next); }} />
                      <Input className="h-7 text-xs" value={p.normalRange} onChange={(e) => { const next = [...editParams]; next[i] = { ...next[i], normalRange: e.target.value }; setEditParams(next); }} />
                      <button type="button" onClick={() => setEditParams(editParams.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80 flex items-center justify-center"><XCircle className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setEditParams([...editParams, { name: "", unit: "", normalRange: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Parameter
                </Button>
              </div>
            )}
            {editTest && editParams.length === 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Parameters</Label>
                <p className="text-xs text-muted-foreground">No parameters defined.</p>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setEditParams([{ name: "", unit: "", normalRange: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Parameter
                </Button>
              </div>
            )}
            {!editTest && selectedChildTests.length === 0 && (
              <div>
                <Label className="text-xs">Parameters (comma separated)</Label>
                <Input value={testForm.parameters} onChange={(e) => setTestForm((p) => ({ ...p, parameters: e.target.value }))} placeholder="e.g. Hemoglobin, WBC, Platelets" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetTestDialog}>Cancel</Button>
            <Button onClick={editTest ? handleSaveEditTest : handleAddTest}>{editTest ? "Save Changes" : "Add Test"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Inventory Category Dialog */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Inventory Category</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">Category Name</Label>
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Implants" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategory(false)}>Cancel</Button>
            <Button onClick={handleAddCategory}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lab Category Dialog */}
      <Dialog open={showAddLabCategory} onOpenChange={setShowAddLabCategory}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Lab Test Category</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">Category Name</Label>
            <Input value={newLabCategory} onChange={(e) => setNewLabCategory(e.target.value)} placeholder="e.g. Microbiology" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLabCategory(false)}>Cancel</Button>
            <Button onClick={handleAddLabCategory}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lab Category Dialog */}
      <Dialog open={!!editLabCategory} onOpenChange={(open) => { if (!open) setEditLabCategory(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Lab Category</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">Category Name</Label>
            <Input value={editLabCategory?.new || ""} onChange={(e) => setEditLabCategory((p) => p ? { ...p, new: e.target.value } : null)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLabCategory(null)}>Cancel</Button>
            <Button onClick={handleEditLabCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Asset Dialog */}
      <Dialog open={showAddAsset || !!editAsset} onOpenChange={(open) => { if (!open) { setShowAddAsset(false); setEditAsset(null); setAssetForm({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editAsset ? "Edit Asset" : "Add Hospital Asset"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Asset Name *</Label>
              <Input value={assetForm.name || ""} onChange={(e) => setAssetForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Ventilator" />
            </div>
            <div>
              <Label className="text-xs">Asset Tag *</Label>
              <Input value={assetForm.assetTag || ""} onChange={(e) => setAssetForm((p) => ({ ...p, assetTag: e.target.value }))} placeholder="AST-0009" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={assetForm.category || "Medical Equipment"} onValueChange={(v) => setAssetForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{assetCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Department</Label>
              <Select value={assetForm.department || "Store"} onValueChange={(v) => setAssetForm((p) => ({ ...p, department: v as Department }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input value={assetForm.location || ""} onChange={(e) => setAssetForm((p) => ({ ...p, location: e.target.value }))} placeholder="e.g. ICU Bed 3" />
            </div>
            <div>
              <Label className="text-xs">Manufacturer</Label>
              <Input value={assetForm.manufacturer || ""} onChange={(e) => setAssetForm((p) => ({ ...p, manufacturer: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Input value={assetForm.model || ""} onChange={(e) => setAssetForm((p) => ({ ...p, model: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Serial No</Label>
              <Input value={assetForm.serialNo || ""} onChange={(e) => setAssetForm((p) => ({ ...p, serialNo: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Purchase Date</Label>
              <Input type="date" value={assetForm.purchaseDate || ""} onChange={(e) => setAssetForm((p) => ({ ...p, purchaseDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Purchase Cost (₹)</Label>
              <Input type="number" value={assetForm.purchaseCost || 0} onChange={(e) => setAssetForm((p) => ({ ...p, purchaseCost: +e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Warranty Expiry</Label>
              <Input type="date" value={assetForm.warrantyExpiry || ""} onChange={(e) => setAssetForm((p) => ({ ...p, warrantyExpiry: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={assetForm.status || "Active"} onValueChange={(v) => setAssetForm((p) => ({ ...p, status: v as AssetStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{assetStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Condition</Label>
              <Select value={assetForm.condition || "Good"} onValueChange={(v) => setAssetForm((p) => ({ ...p, condition: v as AssetCondition }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{assetConditions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assigned To</Label>
              <Input value={assetForm.assignedTo || ""} onChange={(e) => setAssetForm((p) => ({ ...p, assignedTo: e.target.value }))} placeholder="e.g. Dr. Mehta" />
            </div>
            <div>
              <Label className="text-xs">Last Maintenance</Label>
              <Input type="date" value={assetForm.lastMaintenanceDate || ""} onChange={(e) => setAssetForm((p) => ({ ...p, lastMaintenanceDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Next Maintenance</Label>
              <Input type="date" value={assetForm.nextMaintenanceDate || ""} onChange={(e) => setAssetForm((p) => ({ ...p, nextMaintenanceDate: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={assetForm.notes || ""} onChange={(e) => setAssetForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddAsset(false); setEditAsset(null); setAssetForm({}); }}>Cancel</Button>
            <Button onClick={handleSaveAsset}>{editAsset ? "Save Changes" : "Add Asset"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ward Add/Edit Dialog */}
      <Dialog open={showWardDialog} onOpenChange={(open) => { if (!open) { setShowWardDialog(false); setWardEditId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{wardEditId ? "Edit Ward" : "Add New Ward"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Ward Name *</Label>
              <Input value={wardForm.name} onChange={(e) => setWardForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Pediatric Ward" />
            </div>
            <div>
              <Label className="text-xs">Department</Label>
              <Select value={wardForm.department} onValueChange={(v) => setWardForm((p) => ({ ...p, department: v as Department }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Total Beds</Label>
              <Input type="number" min={1} value={wardForm.totalBeds} onChange={(e) => setWardForm((p) => ({ ...p, totalBeds: +e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Charge Per Day (₹)</Label>
              <Input type="number" min={0} value={wardForm.chargePerDay} onChange={(e) => setWardForm((p) => ({ ...p, chargePerDay: +e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowWardDialog(false); setWardEditId(null); }}>Cancel</Button>
            <Button onClick={() => {
              if (!wardForm.name.trim()) { toast.error("Ward name is required"); return; }
              if (wardEditId) {
                updateWard(wardEditId, wardForm);
                toast.success(`${wardForm.name} updated`);
              } else {
                addWard(wardForm);
                toast.success(`${wardForm.name} added`);
              }
              setShowWardDialog(false);
              setWardEditId(null);
            }}>{wardEditId ? "Save Changes" : "Add Ward"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ──── Stat Card ────
const StatCard = ({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent: string }) => (
  <div className="bg-card rounded-xl border border-border p-3">
    <div className={cn("flex items-center gap-1.5 mb-1", accent)}>{icon}<span className="text-xs font-medium">{label}</span></div>
    <p className="text-lg font-bold text-foreground">{value}</p>
  </div>
);

export default Inventory;
