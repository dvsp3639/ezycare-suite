import {
  UserPlus,
  Building2,
  Sun,
  Scissors,
  BedDouble,
  Stethoscope,
  DollarSign,
  Shield,
  Microscope,
  FileText,
  Package,
  Pill,
  type LucideIcon,
} from "lucide-react";

export interface ModuleItem {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  route: string;
  color: string;
}

export const modules: ModuleItem[] = [
  { id: "patient-registration", title: "Patient Registration", icon: UserPlus, description: "Register & manage patients", route: "/patient-registration", color: "bg-primary/10 text-primary" },
  { id: "clinic-management", title: "Clinic Management", icon: Building2, description: "Manage clinic operations", route: "/clinic-management", color: "bg-info/10 text-info" },
  { id: "day-care", title: "Day Care Service", icon: Sun, description: "Day care procedures", route: "/day-care", color: "bg-warning/10 text-warning" },
  { id: "operation-theatre", title: "Operation Theatre", icon: Scissors, description: "OT scheduling & management", route: "/operation-theatre", color: "bg-destructive/10 text-destructive" },
  { id: "ipd", title: "IPD", icon: BedDouble, description: "In-patient department", route: "/ipd", color: "bg-success/10 text-success" },
  { id: "nurse-station", title: "Nurse Station", icon: Stethoscope, description: "Nursing workflows", route: "/nurse-station", color: "bg-primary/10 text-primary" },
  { id: "accounts", title: "Accounts & Revenue", icon: DollarSign, description: "Financial management", route: "/accounts", color: "bg-success/10 text-success" },
  { id: "insurance", title: "Insurance", icon: Shield, description: "Insurance claims & processing", route: "/insurance", color: "bg-info/10 text-info" },
  { id: "diagnostics", title: "Diagnostics", icon: Microscope, description: "Lab & diagnostic services", route: "/diagnostics", color: "bg-warning/10 text-warning" },
  { id: "discharge-summary", title: "Discharge Summary", icon: FileText, description: "Patient discharge records", route: "/discharge-summary", color: "bg-primary/10 text-primary" },
  { id: "inventory", title: "Inventory", icon: Package, description: "Stock & inventory management", route: "/inventory", color: "bg-destructive/10 text-destructive" },
  { id: "pharmacy", title: "Pharmacy", icon: Pill, description: "Pharmacy management", route: "/pharmacy", color: "bg-info/10 text-info" },
];
