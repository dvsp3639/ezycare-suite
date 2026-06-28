## Goal
Keep the existing `PrescriptionScanner` architecture intact and layer in the 10 workflow improvements. Work splits into 5 focused passes inside `src/components/pharmacy/PrescriptionScanner.tsx` plus a few supporting files.

## New Workflow
```
Scan/Upload (multi-page, enhance) → Patient Gate → AI Extract
   → Inventory Match → Edit & Add → Verify Checklist (+ optional Barcode) → Apply to Cart → Bill → Pay → Deduct
```

## Changes by area

### 1. Adobe-style Document Scanner (`upload` step)
- New `ScannerCapture` sub-component handles multi-page capture.
- Per page, run a client-side enhancement pipeline on `<canvas>`:
  - Grayscale luminance pass → Otsu-based brightness/contrast stretch
  - Adaptive shadow removal (subtract blurred background)
  - Auto-rotate using EXIF orientation when present
  - Edge detection via Sobel + largest-quad heuristic → perspective warp (4-point homography) with manual corner-drag fallback
- Pages list with thumbnails: reorder (drag), delete, "Add page", "Retake", preview modal.
- Merge final pages into one PDF (using existing jsPDF) before sending to `prescription-scan-ai`. (Edge function already accepts PDFs.)
- All heavy logic runs in a new util `src/lib/docScan.ts` (pure functions, no extra deps).
- Note: "Adobe-level" perspective warp on the web has limits — we implement a solid heuristic plus manual corner adjust, not a full ML segmenter.

### 2. Mandatory Patient Gate (new step `patient` between upload and extracting)
- Block AI call until: Patient Name, Mobile, and OP/IP # (one of) filled.
- Quick-search existing patients (reuses `patientService.search`); if match → auto-fill UHID, age, gender, last doctor/department. If no match → inline "Quick Register" form that calls `patientService.create`.
- Optional fields: UHID, Age, Gender, Doctor, Department.

### 3. Fully Editable AI Results (`review` step rewrite)
For every row add: ✏ Edit, ➕ Add, 🗑 Delete, ⎘ Duplicate, ↕ Reorder, ⤴ Merge-with-duplicate.
Editable fields: name, brand, generic, strength, dosage, frequency, duration, quantity, instructions.
"Add another medicine" creates an empty row with intelligent-search field focused.

### 4. Intelligent Inventory Search (in edit mode)
- 2-char debounced search using existing `useSmartMedicineSearch` (already wired to `searchMedicines` + `fuse`).
- Dropdown shows top 8 with stock, batch, expiry, rack, GST.
- Selecting a result: sets `matchId`, marks `substituted` if name differs, records correction.

### 5. AI Learning loop
- New table `prescription_corrections` (hospital_id, doctor_name, ai_text, corrected_medicine_id, picks, last_used_at).
- On every manual replacement, upsert a row (RPC `record_rx_correction`).
- On next AI extraction, after we get raw AI output, query corrections for `(hospital_id, doctor_name)` and pre-apply matches where `ai_text` matches a row's AI name (case-insensitive trigram).
- Doctor-specific only; falls back to hospital-wide then global if no hit.

### 6. Verification Checklist
Already present; keep 5-point checklist plus an explicit "Verified by Pharmacist" master checkbox (auto-checks remaining when ticked, prevents accidental skip).

### 7. Inventory Match Panel
Already partially there. Add per row: Rack location, Generic equivalent badge, Alternative-brands chip list (top 3 from `searchMedicines` by generic), explicit "Out of Stock" red banner.

### 8. Optional Barcode Verification (new step `barcode`, skippable)
- Uses existing `@zxing` integration from `UniversalScanner` (extract to `src/lib/barcodeReader.ts` if needed).
- For each verified row, pharmacist may scan the physical pack. If barcode matches `medicines.barcode` → ✅; mismatch → ⚠ warning, block until override or re-pick.

### 9. Audit Trail (persist on every state change)
Extend `prescription_scans` with: `pages` (jsonb of page metadata), `enhanced_file_path`, `corrections` (jsonb array of {field, from, to, by, at}), `barcode_verifications` (jsonb), `dispensed_by`, `dispensed_at`, `payment_id`.
Already-present columns reused: scanned_by, verified_by, extracted_payload, verified_items.
Hook into existing `pharmacy_orders.prescription_scan_id` link for payment + deduction trail.

### 10. Files touched
- `src/components/pharmacy/PrescriptionScanner.tsx` — extend wizard with steps `patient` and `barcode`; new row editor.
- `src/components/pharmacy/ScannerCapture.tsx` (new) — multi-page scan UI.
- `src/lib/docScan.ts` (new) — enhancement + perspective utilities.
- `src/lib/barcodeReader.ts` (new) — extracted ZXing helper.
- `src/modules/pharmacy/services.ts` — `recordCorrection`, `applyLearnedCorrections` helpers.
- DB migration — new `prescription_corrections` table + GRANT/RLS + RPC `record_rx_correction` + columns added to `prescription_scans`.

## Out of scope / honest limits
- Real handwriting-recognition model training is impossible client-side; "AI learning" is implemented as the doctor-scoped correction memory above, which materially improves repeat prescriptions without a custom ML model.
- Perspective correction quality varies with photo quality; manual corner drag is provided.

## Estimated size
Sizable but contained — ~1 migration, 3 new files, 1 large edit. No new npm deps required (uses existing `jspdf`, `fuse.js`, `@zxing` if already present; otherwise we add `@zxing/browser` only for barcode step).

Approve to start implementation, or tell me which sections to drop/defer (e.g. skip barcode step, skip perspective warp) and I'll scope down.