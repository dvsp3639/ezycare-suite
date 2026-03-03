import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { format } from "date-fns";
import {
  mockInventory,
  type InventoryItem,
  type Department,
} from "@/data/mockInventoryData";
import {
  mockWards,
  mockBeds,
  type Ward,
  type Bed,
  type BedStatus,
  type WardType,
} from "@/data/mockIPDData";

interface WardsBedContextType {
  // Inventory ward items (category === "Wards")
  wardInventoryItems: InventoryItem[];
  // IPD ward objects
  wards: Ward[];
  beds: Bed[];
  setBeds: React.Dispatch<React.SetStateAction<Bed[]>>;
  // CRUD
  addWard: (data: { name: string; department: Department; totalBeds: number; chargePerDay: number; type?: WardType; floor?: string }) => void;
  updateWard: (id: string, data: { name: string; department: Department; totalBeds: number; chargePerDay: number }) => void;
  deleteWard: (id: string) => void;
  // Bed maintenance
  toggleBedMaintenance: (bedInventoryId: string) => void;
}

const WardsBedContext = createContext<WardsBedContextType | null>(null);

export const useWardsBeds = () => {
  const ctx = useContext(WardsBedContext);
  if (!ctx) throw new Error("useWardsBeds must be used within WardsBedProvider");
  return ctx;
};

// Map a ward name to a WardType heuristic
function guessWardType(name: string): WardType {
  const n = name.toLowerCase();
  if (n.includes("icu") && !n.includes("nicu")) return "ICU";
  if (n.includes("nicu")) return "NICU";
  if (n.includes("private") && n.includes("semi")) return "Semi-Private";
  if (n.includes("private")) return "Private";
  if (n.includes("isolation")) return "Isolation";
  if (n.includes("maternity")) return "Maternity";
  if (n.includes("pediatric") || n.includes("paediatric")) return "Pediatric";
  return "General";
}

export const WardsBedProvider = ({ children }: { children: ReactNode }) => {
  // Single source of truth for ward inventory items
  const initialWardItems = mockInventory.filter((i) => i.category === "Wards");
  const initialBedItems = mockInventory.filter((i) => i.category === "Beds");
  const [wardInventoryItems, setWardInventoryItems] = useState<InventoryItem[]>(initialWardItems);
  const [bedInventoryItems, setBedInventoryItems] = useState<InventoryItem[]>(initialBedItems);

  // Derive IPD wards from inventory items, merging with mockWards for extra fields (type, floor)
  const [wardMeta, setWardMeta] = useState<Record<string, { type: WardType; floor: string }>>(() => {
    const meta: Record<string, { type: WardType; floor: string }> = {};
    mockWards.forEach((w) => {
      // Match by name
      meta[w.name] = { type: w.type, floor: w.floor };
    });
    return meta;
  });

  const wards: Ward[] = wardInventoryItems.map((item) => {
    const meta = wardMeta[item.name] || { type: guessWardType(item.name), floor: "Ground Floor" };
    return {
      id: item.id,
      name: item.name,
      type: meta.type,
      floor: meta.floor,
      totalBeds: item.stock,
      chargePerDay: item.sellingPrice,
    };
  });

  // Beds: derive from wards, but keep dynamic state (occupied, maintenance)
  const [beds, setBeds] = useState<Bed[]>(mockBeds);

  // Sync beds when wards change - regenerate beds for new wards
  const syncBedsForWards = useCallback((newWards: Ward[]) => {
    setBeds((prevBeds) => {
      const existingWardIds = new Set(prevBeds.map((b) => b.wardId));
      let updatedBeds = [...prevBeds];

      // Add beds for new wards
      newWards.forEach((ward) => {
        if (!existingWardIds.has(ward.id)) {
          for (let i = 1; i <= ward.totalBeds; i++) {
            const bedNum = `${ward.name.split(" ").map((w) => w[0]).join("")}-${i.toString().padStart(2, "0")}`;
            updatedBeds.push({
              id: `bed-${ward.id}-${i}`,
              bedNumber: bedNum,
              wardId: ward.id,
              wardName: ward.name,
              status: "Available",
            });
          }
        }
      });

      // Remove beds for deleted wards
      const currentWardIds = new Set(newWards.map((w) => w.id));
      updatedBeds = updatedBeds.filter((b) => currentWardIds.has(b.wardId));

      // Update ward names and handle bed count changes
      newWards.forEach((ward) => {
        const wardBeds = updatedBeds.filter((b) => b.wardId === ward.id);
        // Update ward name on existing beds
        wardBeds.forEach((b) => { b.wardName = ward.name; });

        // Add more beds if totalBeds increased
        if (wardBeds.length < ward.totalBeds) {
          for (let i = wardBeds.length + 1; i <= ward.totalBeds; i++) {
            const bedNum = `${ward.name.split(" ").map((w) => w[0]).join("")}-${i.toString().padStart(2, "0")}`;
            updatedBeds.push({
              id: `bed-${ward.id}-${i}`,
              bedNumber: bedNum,
              wardId: ward.id,
              wardName: ward.name,
              status: "Available",
            });
          }
        }
      });

      return updatedBeds;
    });
  }, []);

  const addWard = useCallback((data: { name: string; department: Department; totalBeds: number; chargePerDay: number; type?: WardType; floor?: string }) => {
    const id = `inv-ward-${Date.now()}`;
    const newItem: InventoryItem = {
      id,
      name: data.name,
      category: "Wards",
      sku: `WRD-${Date.now().toString().slice(-4)}`,
      batchNo: `W${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`,
      manufacturer: "N/A",
      unitPrice: 0,
      sellingPrice: data.chargePerDay,
      stock: data.totalBeds,
      minStock: 0,
      unit: "Beds",
      hsnCode: "N/A",
      gstPercent: 0,
      department: data.department,
      barcode: `${Date.now()}`,
      lastUpdated: format(new Date(), "yyyy-MM-dd"),
      vendor: "N/A",
      purchaseDate: format(new Date(), "yyyy-MM-dd"),
      consumptionRate: 0,
    };
    setWardInventoryItems((prev) => [...prev, newItem]);
    const wardType = data.type || guessWardType(data.name);
    const floor = data.floor || "Ground Floor";
    setWardMeta((prev) => ({ ...prev, [data.name]: { type: wardType, floor } }));

    // Sync beds
    const newWard: Ward = { id, name: data.name, type: wardType, floor, totalBeds: data.totalBeds, chargePerDay: data.chargePerDay };
    syncBedsForWards([...wardInventoryItems.map((item) => {
      const meta = wardMeta[item.name] || { type: guessWardType(item.name), floor: "Ground Floor" };
      return { id: item.id, name: item.name, type: meta.type, floor: meta.floor, totalBeds: item.stock, chargePerDay: item.sellingPrice };
    }), newWard]);
  }, [wardInventoryItems, wardMeta, syncBedsForWards]);

  const updateWard = useCallback((id: string, data: { name: string; department: Department; totalBeds: number; chargePerDay: number }) => {
    setWardInventoryItems((prev) => {
      const updated = prev.map((i) => i.id === id ? { ...i, name: data.name, department: data.department, stock: data.totalBeds, sellingPrice: data.chargePerDay, lastUpdated: format(new Date(), "yyyy-MM-dd") } : i);
      // Sync beds after update
      const newWards = updated.map((item) => {
        const meta = wardMeta[item.name] || { type: guessWardType(item.name), floor: "Ground Floor" };
        return { id: item.id, name: item.name, type: meta.type, floor: meta.floor, totalBeds: item.stock, chargePerDay: item.sellingPrice };
      });
      syncBedsForWards(newWards);
      return updated;
    });
    // Update meta if name changed
    setWardMeta((prev) => {
      const old = wardInventoryItems.find((i) => i.id === id);
      if (old && old.name !== data.name) {
        const meta = prev[old.name] || { type: guessWardType(data.name), floor: "Ground Floor" };
        const next = { ...prev, [data.name]: meta };
        delete next[old.name];
        return next;
      }
      return prev;
    });
  }, [wardInventoryItems, wardMeta, syncBedsForWards]);

  const deleteWard = useCallback((id: string) => {
    setWardInventoryItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      const newWards = updated.map((item) => {
        const meta = wardMeta[item.name] || { type: guessWardType(item.name), floor: "Ground Floor" };
        return { id: item.id, name: item.name, type: meta.type, floor: meta.floor, totalBeds: item.stock, chargePerDay: item.sellingPrice };
      });
      syncBedsForWards(newWards);
      return updated;
    });
  }, [wardMeta, syncBedsForWards]);

  const toggleBedMaintenance = useCallback((bedInventoryId: string) => {
    setBedInventoryItems((prev) => prev.map((i) => {
      if (i.id !== bedInventoryId) return i;
      return { ...i, stock: i.stock > 0 ? 0 : (i.minStock || 1), lastUpdated: format(new Date(), "yyyy-MM-dd") };
    }));
  }, []);

  return (
    <WardsBedContext.Provider value={{
      wardInventoryItems,
      wards,
      beds,
      setBeds,
      addWard,
      updateWard,
      deleteWard,
      toggleBedMaintenance,
    }}>
      {children}
    </WardsBedContext.Provider>
  );
};
