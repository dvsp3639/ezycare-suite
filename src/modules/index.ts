/**
 * Module Index - Central export point for all module services, hooks, and types.
 * 
 * Architecture:
 * ├── patients/     - Patient registration & search
 * ├── clinic/       - Doctor schedules, OP queue, consultations
 * ├── diagnostics/  - Lab test catalog, orders, results
 * ├── pharmacy/     - Medicine inventory, pharmacy orders
 * ├── inventory/    - Stock management, transfers, vendors
 * ├── ipd/          - Wards, beds, admissions, clinical records
 * ├── daycare/      - Day care treatments, sessions, billing
 * └── staff/        - HR profiles, payroll, attendance, leaves
 */

// ─── Services ───
export { patientService } from "./patients/services";
export { clinicService } from "./clinic/services";
export { diagnosticsService } from "./diagnostics/services";
export { pharmacyService } from "./pharmacy/services";
export { inventoryService } from "./inventory/services";
export { ipdService } from "./ipd/services";
export { daycareService } from "./daycare/services";
export { staffService } from "./staff/services";

// ─── Re-export hooks ───
export * from "./patients/hooks";
export * from "./clinic/hooks";
export * from "./diagnostics/hooks";
export * from "./pharmacy/hooks";
export * from "./inventory/hooks";
export * from "./ipd/hooks";
export * from "./daycare/hooks";
export * from "./staff/hooks";
