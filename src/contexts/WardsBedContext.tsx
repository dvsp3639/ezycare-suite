import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useWards as useIpdWards, useBeds as useIpdBeds } from "@/modules/ipd/hooks";
import { ipdService } from "@/modules/ipd/services";

export type WardType = "General" | "Semi-Private" | "Private" | "ICU" | "NICU" | "Isolation" | "Maternity" | "Pediatric";
export type BedStatus = "Available" | "Occupied" | "Under Maintenance";
export type Department = "Store" | "Pharmacy" | "ICU" | "OT" | "Lab" | "Ward A" | "Ward B" | "Emergency" | "Admin";

export interface Ward {
  id: string;
  name: string;
  type: WardType;
  floor: string;
  totalBeds: number;
  chargePerDay: number;
}

export interface Bed {
  id: string;
  bedNumber: string;
  wardId: string;
  wardName: string;
  status: BedStatus;
  patientId?: string;
  patientName?: string;
  admissionId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
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
  consumptionRate: number;
}

interface WardsBedContextType {
  wardInventoryItems: InventoryItem[];
  wards: Ward[];
  beds: Bed[];
  setBeds: React.Dispatch<React.SetStateAction<Bed[]>>;
  addWard: (data: { name: string; department: Department; totalBeds: number; chargePerDay: number; type?: WardType; floor?: string }) => Promise<void>;
  updateWard: (id: string, data: { name: string; department: Department; totalBeds: number; chargePerDay: number }) => Promise<void>;
  deleteWard: (id: string) => Promise<void>;
  toggleBedMaintenance: (bedInventoryId: string) => void;
}

const WardsBedContext = createContext<WardsBedContextType | null>(null);

export const useWardsBeds = () => {
  const ctx = useContext(WardsBedContext);
  if (!ctx) throw new Error("useWardsBeds must be used within WardsBedProvider");
  return ctx;
};

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
  const { data: dbWards = [], refetch: refetchWards } = useIpdWards();
  const { data: dbBeds = [], refetch: refetchBeds } = useIpdBeds();

  const [localWards, setLocalWards] = useState<Ward[]>([]);
  const [localBeds, setLocalBeds] = useState<Bed[]>([]);

  // Sync DB wards to local state (including empty results, so deletes reflect immediately)
  useEffect(() => {
    setLocalWards((dbWards as any[]).map((w: any) => ({
      id: w.id,
      name: w.name,
      type: w.type || guessWardType(w.name),
      floor: w.floor || "Ground Floor",
      totalBeds: w.totalBeds ?? 0,
      chargePerDay: Number(w.chargePerDay ?? 0),
    })));
  }, [dbWards]);

  // Sync DB beds to local state
  useEffect(() => {
    setLocalBeds((dbBeds as any[]).map((b: any) => {
      const ward = (dbWards as any[]).find((w: any) => w.id === b.wardId);
      return {
        id: b.id,
        bedNumber: b.bedNumber || "",
        wardId: b.wardId || "",
        wardName: ward?.name || "",
        status: (b.status || "Available") as BedStatus,
        patientId: b.patientId || undefined,
        admissionId: b.admissionId || undefined,
      };
    }));
  }, [dbBeds, dbWards]);

  const wards = localWards;
  const beds = localBeds;

  // Wards surfaced as inventory-shaped rows for the Inventory → Beds & Wards tab
  const wardInventoryItems: InventoryItem[] = useMemo(
    () =>
      localWards.map((w) => {
        const wardBeds = localBeds.filter((b) => b.wardId === w.id);
        return {
          id: w.id,
          name: w.name,
          category: "Wards",
          sku: `WRD-${w.id.slice(0, 6).toUpperCase()}`,
          batchNo: "",
          manufacturer: "",
          unitPrice: 0,
          sellingPrice: w.chargePerDay,
          stock: wardBeds.length || w.totalBeds,
          minStock: 0,
          unit: "Bed",
          hsnCode: "",
          gstPercent: 0,
          department: (w.floor as Department) || ("Ward A" as Department),
          barcode: "",
          lastUpdated: new Date().toISOString().split("T")[0],
          vendor: "",
          purchaseDate: "",
          consumptionRate: 0,
        } as InventoryItem;
      }),
    [localWards, localBeds]
  );

  const addWard = useCallback(async (data: { name: string; department: Department; totalBeds: number; chargePerDay: number; type?: WardType; floor?: string }) => {
    const wardType = data.type || guessWardType(data.name);
    const floor = data.floor || data.department || "Ground Floor";
    const ward = await ipdService.createWard({
      name: data.name,
      type: wardType,
      floor,
      total_beds: data.totalBeds,
      charge_per_day: data.chargePerDay,
    } as any);

    // Physically create the beds that belong to this ward
    const count = Math.max(0, Math.floor(data.totalBeds || 0));
    const prefix = data.name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3) || "BED";
    for (let i = 1; i <= count; i++) {
      await ipdService.createBed({
        ward_id: (ward as any).id,
        bed_number: `${prefix}-${String(i).padStart(2, "0")}`,
        status: "Available",
      } as any);
    }
    await Promise.all([refetchWards(), refetchBeds()]);
  }, [refetchWards, refetchBeds]);

  const updateWard = useCallback(async (id: string, data: { name: string; department: Department; totalBeds: number; chargePerDay: number }) => {
    await ipdService.updateWard(id, {
      name: data.name,
      total_beds: data.totalBeds,
      charge_per_day: data.chargePerDay,
    } as any);

    // Reconcile bed rows with the new total
    const existing = await ipdService.getBeds(id);
    const target = Math.max(0, Math.floor(data.totalBeds || 0));
    const prefix = data.name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "BED";
    if (existing.length < target) {
      for (let i = existing.length + 1; i <= target; i++) {
        await ipdService.createBed({
          ward_id: id,
          bed_number: `${prefix}-${String(i).padStart(2, "0")}`,
          status: "Available",
        } as any);
      }
    } else if (existing.length > target) {
      const removable = (existing as any[]).filter((b) => b.status !== "Occupied").slice(target);
      for (const b of removable) {
        await ipdService.deleteBed(b.id);
      }
    }
    await Promise.all([refetchWards(), refetchBeds()]);
  }, [refetchWards, refetchBeds]);

  const deleteWard = useCallback(async (id: string) => {
    await ipdService.deleteWard(id);
    await Promise.all([refetchWards(), refetchBeds()]);
  }, [refetchWards, refetchBeds]);

  const toggleBedMaintenance = useCallback(async (bedId: string) => {
    setLocalBeds(prev => prev.map(b => {
      if (b.id !== bedId) return b;
      const newStatus: BedStatus = b.status === "Under Maintenance" ? "Available" : "Under Maintenance";
      ipdService.updateBed(b.id, { status: newStatus } as any).catch(console.error);
      return { ...b, status: newStatus };
    }));
  }, []);

  return (
    <WardsBedContext.Provider value={{
      wardInventoryItems,
      wards,
      beds,
      setBeds: setLocalBeds,
      addWard,
      updateWard,
      deleteWard,
      toggleBedMaintenance,
    }}>
      {children}
    </WardsBedContext.Provider>
  );
};