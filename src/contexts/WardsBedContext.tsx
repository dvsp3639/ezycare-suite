import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
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
  addWard: (data: { name: string; department: Department; totalBeds: number; chargePerDay: number; type?: WardType; floor?: string }) => void;
  updateWard: (id: string, data: { name: string; department: Department; totalBeds: number; chargePerDay: number }) => void;
  deleteWard: (id: string) => void;
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

  // Sync DB wards to local state
  useEffect(() => {
    if (dbWards.length > 0) {
      setLocalWards(dbWards.map((w: any) => ({
        id: w.id,
        name: w.name,
        type: w.type || guessWardType(w.name),
        floor: w.floor || "Ground Floor",
        totalBeds: w.totalBeds ?? 0,
        chargePerDay: w.chargePerDay ?? 0,
      })));
    }
  }, [dbWards]);

  // Sync DB beds to local state
  useEffect(() => {
    if (dbBeds.length > 0) {
      setLocalBeds(dbBeds.map((b: any) => {
        const ward = localWards.find(w => w.id === b.wardId);
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
    }
  }, [dbBeds, localWards]);

  const wards = localWards;
  const beds = localBeds;

  const addWard = useCallback(async (data: { name: string; department: Department; totalBeds: number; chargePerDay: number; type?: WardType; floor?: string }) => {
    try {
      const wardType = data.type || guessWardType(data.name);
      const floor = data.floor || "Ground Floor";
      await ipdService.createWard({
        name: data.name,
        type: wardType,
        floor,
        total_beds: data.totalBeds,
        charge_per_day: data.chargePerDay,
      } as any);
      refetchWards();
      refetchBeds();
    } catch (err) {
      console.error("Failed to add ward:", err);
    }
  }, [refetchWards, refetchBeds]);

  const updateWard = useCallback(async (id: string, data: { name: string; department: Department; totalBeds: number; chargePerDay: number }) => {
    try {
      await ipdService.updateWard(id, {
        name: data.name,
        total_beds: data.totalBeds,
        charge_per_day: data.chargePerDay,
      } as any);
      refetchWards();
      refetchBeds();
    } catch (err) {
      console.error("Failed to update ward:", err);
    }
  }, [refetchWards, refetchBeds]);

  const deleteWard = useCallback(async (id: string) => {
    // Remove locally
    setLocalWards(prev => prev.filter(w => w.id !== id));
    setLocalBeds(prev => prev.filter(b => b.wardId !== id));
  }, []);

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
      wardInventoryItems: [],
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