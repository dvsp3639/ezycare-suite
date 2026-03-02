import { useState, useMemo } from "react";
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
  Package, Search, Plus, Edit, Trash2, ArrowLeftRight, BarChart3, Settings,
  AlertTriangle, CheckCircle2, QrCode, Scan, TrendingUp, TrendingDown,
  Building2, Star, Printer, Download, IndianRupee, Archive, Clock, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mockInventory, mockTransfers, mockVendors,
  inventoryCategories, departments, categoryColors,
  getExpiryStatus, getStockStatus,
  type InventoryItem, type InventoryCategory, type Department, type StockTransfer, type Vendor,
} from "@/data/mockInventoryData";
import { labTestCatalog, type LabTestDefinition } from "@/data/mockDiagnosticsData";
import type { LabCategory } from "@/data/mockClinicData";

// ──── Main Component ────
const Inventory = () => {
  const [activeTab, setActiveTab] = useState("stock");
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
  const [transfers, setTransfers] = useState<StockTransfer[]>(mockTransfers);
  const [vendors] = useState<Vendor[]>(mockVendors);
  const [labTests, setLabTests] = useState<LabTestDefinition[]>(labTestCatalog);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // Stock filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");

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
  const [testForm, setTestForm] = useState({ name: "", category: "Blood" as LabCategory, price: 0, parameters: "" });
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  // Report tab
  const [reportType, setReportType] = useState("summary");

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

  // Lab test handlers
  const handleAddTest = () => {
    if (!testForm.name) { toast.error("Test name required"); return; }
    const params = testForm.parameters.split(",").map((p) => p.trim()).filter(Boolean).map((p) => ({ name: p, unit: "", normalRange: "" }));
    const newTest: LabTestDefinition = {
      id: `lt-${Date.now()}`,
      name: testForm.name,
      category: testForm.category,
      price: testForm.price,
      parameters: params.length > 0 ? params : [{ name: "Result", unit: "", normalRange: "Normal" }],
    };
    setLabTests((prev) => [...prev, newTest]);
    toast.success(`Test "${testForm.name}" added`);
    setShowAddTest(false);
    setTestForm({ name: "", category: "Blood", price: 0, parameters: "" });
  };

  const handleRemoveTest = (testId: string) => {
    setLabTests((prev) => prev.filter((t) => t.id !== testId));
    toast.success("Test removed");
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
          <TabsTrigger value="diagnostics"><Scan className="h-4 w-4 mr-1" /> Diagnostics</TabsTrigger>
          <TabsTrigger value="transfers"><ArrowLeftRight className="h-4 w-4 mr-1" /> Transfers</TabsTrigger>
          <TabsTrigger value="reports"><BarChart3 className="h-4 w-4 mr-1" /> Reports</TabsTrigger>
          <TabsTrigger value="vendors"><Building2 className="h-4 w-4 mr-1" /> Vendors</TabsTrigger>
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

        {/* ════════ DIAGNOSTICS TAB ════════ */}
        <TabsContent value="diagnostics">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Manage lab test catalog — add/remove tests and categories</p>
            <Button size="sm" onClick={() => setShowAddTest(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Test
            </Button>
          </div>
          {(["Blood", "Urine", "Radiology", "Serology"] as LabCategory[]).map((cat) => {
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
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tests.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium text-sm">{t.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.parameters.map((p) => p.name).join(", ")}</TableCell>
                          <TableCell className="text-right text-sm">₹{t.price}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveTest(t.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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

        {/* ════════ VENDORS TAB ════════ */}
        <TabsContent value="vendors">
          <p className="text-sm text-muted-foreground mb-4">Compare vendors by rating, delivery speed, and categories</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.map((v) => (
              <div key={v.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{v.name}</h3>
                  <div className="flex items-center gap-0.5">
                    <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                    <span className="text-xs font-medium">{v.rating}</span>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground mb-3">
                  <p>📞 {v.contact}</p>
                  <p>✉ {v.email}</p>
                  <p>GST: {v.gstNo}</p>
                  <p>Avg Delivery: <span className="font-medium text-foreground">{v.avgDeliveryDays} days</span></p>
                  <p>Last Order: {v.lastOrderDate}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {v.categories.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              </div>
            ))}
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

      {/* Add Test Dialog */}
      <Dialog open={showAddTest} onOpenChange={setShowAddTest}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Diagnostic Test</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Test Name *</Label>
              <Input value={testForm.name} onChange={(e) => setTestForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={testForm.category} onValueChange={(v) => setTestForm((p) => ({ ...p, category: v as LabCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Blood">🩸 Blood</SelectItem>
                  <SelectItem value="Urine">🧪 Urine</SelectItem>
                  <SelectItem value="Radiology">📷 Radiology</SelectItem>
                  <SelectItem value="Serology">🔬 Serology</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Price (₹)</Label>
              <Input type="number" value={testForm.price} onChange={(e) => setTestForm((p) => ({ ...p, price: +e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Parameters (comma separated)</Label>
              <Input value={testForm.parameters} onChange={(e) => setTestForm((p) => ({ ...p, parameters: e.target.value }))} placeholder="e.g. Hemoglobin, WBC, Platelets" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTest(false)}>Cancel</Button>
            <Button onClick={handleAddTest}>Add Test</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
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
