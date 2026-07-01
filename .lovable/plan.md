## Sprint 1 — One Upload Engine, One AI Engine

Goal: Every AI Scanner entry (Pharmacy + Inventory) uses the exact same code path — MobileUploadEngine for picking/uploading, one edge function for classify + extract, then a routed verification step. No two upload paths, no two classifiers.

Nothing outside this pipeline is touched. No new features. No design changes to Pharmacy or Inventory pages beyond swapping the scanner entry.

---

### 1. Shared components (new)

- `src/ai-engine-v2/SharedAiScanFlow.tsx` — the single orchestrator used by both Pharmacy and Inventory. Renders `MobileUploadEngine`, then on `onComplete` calls the router, then mounts the correct verification screen.
- `src/ai-engine-v2/verify/InvoiceVerify.tsx` — editable table for a purchase invoice; approve → `import_purchase_invoice` RPC (existing) → updates inventory + creates purchase bill + audit fields (already in RPC).
- `src/ai-engine-v2/verify/PrescriptionVerify.tsx` — editable list of extracted medicines/patient/doctor; approve → enqueues into existing `workspaceService` so pharmacist can complete billing / stock deduction / patient history exactly like today.
- `src/ai-engine-v2/verify/LabReportVerify.tsx` — minimal: shows classification, links the uploaded file to a `lab_orders` row on approve. (Kept intentionally small; can grow later.)
- `src/ai-engine-v2/router.ts` — thin client that invokes the router edge function and normalises the payload for the verify screens.

### 2. Shared AI edge function (new)

- `supabase/functions/ai-document-router/index.ts` — accepts `{ fileBase64, mimeType }` (already-uploaded file is passed in as base64 to avoid a second network round-trip on mobile).
  1. Runs a Lovable AI Gateway call (Gemini) with a classification prompt → `documentType: "prescription" | "purchase_invoice" | "lab_report"`.
  2. Immediately runs a second Gemini call with a doc-type-specific extraction prompt, returning structured JSON matching the verify screens.
  3. Returns `{ documentType, data, confidence }`.
  Uses `auth.getClaims(token)` per project convention.

### 3. Wire into Pharmacy and Inventory

- `src/pages/Pharmacy.tsx` — remove the `<MedicineInputBar>` camera path (voice + text search stay). Add a single "AI Scanner" button that opens `<SharedAiScanFlow mode="pharmacy" />`.
- `src/pages/Inventory.tsx` — replace `<UniversalScanner … />` with `<SharedAiScanFlow mode="inventory" />`. The "Scan Invoice" button keeps its label and position.
- `src/components/UniversalSearch.tsx` — the global scanner button mounts `<SharedAiScanFlow mode="auto" />` instead of `<UniversalScanner />`.

`mode` is a hint only; the router edge function is the source of truth for `documentType`.

### 4. Retire legacy code

Deleted files (moved out with `git rm`-equivalent shell `rm`):
- `src/components/UniversalScanner.tsx`
- `src/components/pharmacy/MobileScanView.tsx`
- `src/components/pharmacy/MedicineInputBar.tsx` (rebuilt as `MedicineSearchBar.tsx` — text + voice only, no camera)
- `src/lib/mobileScanHelpers.ts` (compression now lives inside MobileUploadEngine)
- `src/lib/mobileUploadDiagnostics.ts` (diagnostic wrapper — no longer needed once one path exists)
- `src/pages/AiCoreTestUpload.tsx` + `src/ai-core/` directory (older prototype, superseded by ai-engine-v2)
- `src/pages/DebugUpload.tsx` if present (temporary diagnostic page)

References cleaned up in `App.tsx` routes, `PharmacyWorkspace.tsx` (its embedded `MobileScanView` becomes a call to `SharedAiScanFlow`), and any leftover imports.

### 5. Acceptance checks

After implementation, verify via Playwright + manual:
- Camera / Gallery / PDF / multi-image / desktop drop → all go through one code path.
- MobileUploadEngine already blocks Android Escape/back and swallows picker cancel — carried forward unchanged, so scanner cannot self-close on file select.
- `ai-document-router` returns a `documentType` on every real medical doc → verification screen opens.
- Approve on verify screen → `import_purchase_invoice` (inventory + audit), or `workspaceService.enqueue` (pharmacy billing + patient history), or `lab_orders` insert.
- Confirm `rg "UniversalScanner|MobileScanView|MedicineInputBar|ai-core/"` returns zero matches.

### Deliberately out of scope
Reports, MFA, notifications, billing redesign, Pharmacy/Inventory redesign, lab report deep extraction, offline queueing. All Sprint 2+.

---

Reply **go** and I will execute end-to-end in one pass: create the router function, build SharedAiScanFlow + 3 verify screens, wire Pharmacy + Inventory + UniversalSearch, delete the six legacy files, then run typecheck.
