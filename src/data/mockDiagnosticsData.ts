import type { LabCategory } from "./mockClinicData";

export interface LabTestDefinition {
  id: string;
  name: string;
  category: LabCategory;
  price: number;
  parameters: { name: string; unit: string; ranges: { normalRange: string; sex?: string; minAge?: number | null; maxAge?: string | null }[] }[];
}

export const labTestCatalog: LabTestDefinition[] = [
  // Blood Tests
  { id: "lt-1", name: "Complete Blood Count (CBC)", category: "Blood", price: 350, parameters: [
    { name: "Hemoglobin", unit: "g/dL", ranges: [
      { normalRange: "13-17", sex: "male" },
      { normalRange: "12-15", sex: "female" },
    ]},
    { name: "WBC", unit: "cells/mcL", ranges: [{ normalRange: "4500-11000" }] },
    { name: "Platelets", unit: "lakh/mcL", ranges: [{ normalRange: "1.5-4.0" }] },
    { name: "RBC", unit: "million/mcL", ranges: [{ normalRange: "4.5-5.5" }] },
  ]},
  { id: "lt-2", name: "Blood Sugar (Fasting)", category: "Blood", price: 100, parameters: [
    { name: "Glucose (Fasting)", unit: "mg/dL", ranges: [{ normalRange: "70-100" }] },
  ]},
  { id: "lt-3", name: "Blood Sugar (PP)", category: "Blood", price: 100, parameters: [
    { name: "Glucose (Post Prandial)", unit: "mg/dL", ranges: [{ normalRange: "< 140" }] },
  ]},
  { id: "lt-4", name: "HbA1c", category: "Blood", price: 450, parameters: [
    { name: "HbA1c", unit: "%", ranges: [{ normalRange: "< 5.7" }] },
  ]},
  { id: "lt-5", name: "Lipid Profile", category: "Blood", price: 500, parameters: [
    { name: "Total Cholesterol", unit: "mg/dL", ranges: [{ normalRange: "< 200" }] },
    { name: "HDL", unit: "mg/dL", ranges: [{ normalRange: "40-60" }] },
    { name: "LDL", unit: "mg/dL", ranges: [{ normalRange: "< 100" }] },
    { name: "Triglycerides", unit: "mg/dL", ranges: [{ normalRange: "< 150" }] },
  ]},
  { id: "lt-6", name: "Liver Function Test (LFT)", category: "Blood", price: 600, parameters: [
    { name: "SGOT (AST)", unit: "U/L", ranges: [{ normalRange: "8-45" }] },
    { name: "SGPT (ALT)", unit: "U/L", ranges: [{ normalRange: "7-56" }] },
    { name: "Bilirubin (Total)", unit: "mg/dL", ranges: [{ normalRange: "0.1-1.2" }] },
    { name: "Albumin", unit: "g/dL", ranges: [{ normalRange: "3.5-5.0" }] },
  ]},
  { id: "lt-7", name: "Kidney Function Test (KFT)", category: "Blood", price: 550, parameters: [
    { name: "Creatinine", unit: "mg/dL", ranges: [{ normalRange: "0.7-1.3" }] },
    { name: "Blood Urea", unit: "mg/dL", ranges: [{ normalRange: "7-20" }] },
    { name: "Uric Acid", unit: "mg/dL", ranges: [{ normalRange: "3.5-7.2" }] },
  ]},
  { id: "lt-8", name: "Thyroid Profile (T3, T4, TSH)", category: "Blood", price: 700, parameters: [
    { name: "T3", unit: "ng/dL", ranges: [{ normalRange: "80-200" }] },
    { name: "T4", unit: "mcg/dL", ranges: [{ normalRange: "5.1-14.1" }] },
    { name: "TSH", unit: "mIU/L", ranges: [{ normalRange: "0.4-4.0" }] },
  ]},
  // Urine Tests
  { id: "lt-9", name: "Urine Routine & Microscopy", category: "Urine", price: 200, parameters: [
    { name: "Color", unit: "", ranges: [{ normalRange: "Pale Yellow" }] },
    { name: "pH", unit: "", ranges: [{ normalRange: "4.6-8.0" }] },
    { name: "Protein", unit: "", ranges: [{ normalRange: "Nil" }] },
    { name: "Sugar", unit: "", ranges: [{ normalRange: "Nil" }] },
    { name: "Pus Cells", unit: "/HPF", ranges: [{ normalRange: "0-5" }] },
  ]},
  { id: "lt-10", name: "Urine Culture & Sensitivity", category: "Urine", price: 800, parameters: [
    { name: "Culture", unit: "", ranges: [{ normalRange: "No Growth" }] },
    { name: "Colony Count", unit: "CFU/mL", ranges: [{ normalRange: "< 10000" }] },
  ]},
  // Radiology
  { id: "lt-11", name: "X-Ray Chest (PA)", category: "Radiology", price: 300, parameters: [
    { name: "Findings", unit: "", ranges: [{ normalRange: "Normal" }] },
  ]},
  { id: "lt-12", name: "X-Ray Spine", category: "Radiology", price: 400, parameters: [
    { name: "Findings", unit: "", ranges: [{ normalRange: "Normal" }] },
  ]},
  { id: "lt-13", name: "USG Abdomen", category: "Radiology", price: 1200, parameters: [
    { name: "Findings", unit: "", ranges: [{ normalRange: "Normal study" }] },
  ]},
  { id: "lt-14", name: "MRI Brain", category: "Radiology", price: 5000, parameters: [
    { name: "Findings", unit: "", ranges: [{ normalRange: "Normal" }] },
  ]},
  { id: "lt-15", name: "ECG", category: "Radiology", price: 250, parameters: [
    { name: "Rhythm", unit: "", ranges: [{ normalRange: "Normal Sinus" }] },
    { name: "Rate", unit: "bpm", ranges: [{ normalRange: "60-100" }] },
    { name: "Findings", unit: "", ranges: [{ normalRange: "Normal" }] },
  ]},
  { id: "lt-16", name: "2D Echo", category: "Radiology", price: 1500, parameters: [
    { name: "Ejection Fraction", unit: "%", ranges: [{ normalRange: "55-70" }] },
    { name: "Findings", unit: "", ranges: [{ normalRange: "Normal" }] },
  ]},
  // Serology
  { id: "lt-17", name: "Widal Test", category: "Serology", price: 250, parameters: [
    { name: "S. Typhi O", unit: "", ranges: [{ normalRange: "< 1:80" }] },
    { name: "S. Typhi H", unit: "", ranges: [{ normalRange: "< 1:80" }] },
  ]},
  { id: "lt-18", name: "Dengue NS1 Antigen", category: "Serology", price: 600, parameters: [
    { name: "NS1 Antigen", unit: "", ranges: [{ normalRange: "Negative" }] },
  ]},
  { id: "lt-19", name: "HIV (I & II)", category: "Serology", price: 400, parameters: [
    { name: "HIV Antibody", unit: "", ranges: [{ normalRange: "Non-Reactive" }] },
  ]},
  { id: "lt-20", name: "HBsAg", category: "Serology", price: 350, parameters: [
    { name: "HBsAg", unit: "", ranges: [{ normalRange: "Non-Reactive" }] },
  ]},
  { id: "lt-21", name: "CRP (C-Reactive Protein)", category: "Serology", price: 500, parameters: [
    { name: "CRP", unit: "mg/L", ranges: [{ normalRange: "< 10" }] },
  ]},
  { id: "lt-22", name: "RA Factor", category: "Serology", price: 450, parameters: [
    { name: "RA Factor", unit: "IU/mL", ranges: [{ normalRange: "< 14" }] },
  ]},
];

export const labCategoryColors: Record<string, string> = {
  Blood: "bg-destructive/10 text-destructive border-destructive/20",
  Urine: "bg-warning/10 text-warning border-warning/20",
  Radiology: "bg-info/10 text-info border-info/20",
  Serology: "bg-primary/10 text-primary border-primary/20",
};
