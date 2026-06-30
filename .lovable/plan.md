## Goal

Replace the current ad-hoc scanner stack (`UniversalScanner`, `MedicineInputBar` camera, `MobileScanView`, scattered AI calls) with a **single AI Core Engine** that every HMS module reuses. Existing Pharmacy, Inventory, Diagnostics, Billing, Patients, Auth flows stay untouched — only their AI entry points are rewired to the new engine.

Build strictly **one layer at a time**. Ship Layer 1, verify on Android + desktop, then move on. This plan describes the full target; we will only execute Layer 1 after you approve.

## Target architecture

```text
src/ai-core/
  upload/          Layer 1 — Universal Upload Engine
    UploadEngine.tsx        mobile-first picker (camera/gallery/files/drag-drop)
    enhance.ts              crop, deskew, shadow-remove, compress (reuses docScan.ts)
    uploader.ts             chunked upload to `ai-core-uploads` bucket + retry + progress
    types.ts                UploadedFile, UploadProgress, UploadResult
    hooks.ts                useUploadEngine()
  classify/        Layer 2 — Document Classification Engine
    classifier.ts           calls edge fn `ai-classify`, returns DocumentKind
    types.ts                DocumentKind = prescription|purchase_invoice|lab_report|medicine_label|barcode|qr|unknown
  extract/         Layer 3 — AI Extraction Engine
    extractors/             one schema + prompt per DocumentKind
    extractEngine.ts        single entry: extract(kind, files) -> StructuredPayload
    schemas.ts              zod schemas per kind
  verify/          Layer 4 — Human Verification
    VerifyShell.tsx         shared editable shell (mobile sheet / desktop dialog)
    renderers/              kind-specific editable tables (Prescription, Invoice, LabReport)
  connector/       Layer 5 — HMS Connector
    routes.ts               kind -> module handler map
    handlers/               prescriptionToPharmacy.ts, invoiceToInventory.ts, labToDiagnostics.ts
  memory/          Learning loop
    corrections.ts          wraps existing record_rx_correction + new generic table
  AiCoreProvider.tsx        single context exposing openAiCore({ accept?, hintKind? })
  index.ts
supabase/functions/
  ai-classify/            new — fast classifier (Gemini Flash, low tokens)
  ai-extract/             new — kind-routed extractor (replaces prescription-scan-ai + medicine-scan-ai usage from the engine)
```

Existing edge functions stay deployed for back-compat until Layer 3 is live; then `UniversalScanner.tsx`, `MobileScanView.tsx`, the camera button inside `MedicineInputBar.tsx`, and the inventory "Scan Invoice" wizard are rewired to call `openAiCore()`.

## Phased delivery

**Phase 1 — Layer 1 only (this turn if approved)**
- Scaffold `src/ai-core/upload/` with `UploadEngine.tsx`, `enhance.ts` (thin wrapper around existing `docScan.ts` + `mobileScanHelpers.ts`), `uploader.ts`, `hooks.ts`, `types.ts`.
- Create private storage bucket `ai-core-uploads` (path: `{hospital_id}/{user_id}/{yyyy-mm-dd}/{uuid}.{ext}`) with RLS: insert/select/update/delete restricted to uploader's folder; service_role full.
- Mobile-first UI: full-screen sheet, big Camera / Gallery / Files buttons, multi-file thumbnails, per-file progress, retry, remove. Desktop: same component with drag-and-drop zone.
- Logging via existing `mobileUploadDiagnostics.ts`.
- Demo route `/ai-core/test-upload` (dev only) to verify end-to-end on Android.
- **No classification, no AI, no HMS writes in this phase.**

**Phase 2 — Layer 2** Classifier edge fn + `classify/` module. Hook into UploadEngine `onComplete`. Show detected kind chip.

**Phase 3 — Layer 3** Extractor edge fn with per-kind schemas. Stream structured JSON back.

**Phase 4 — Layer 4** VerifyShell + per-kind editable renderers.

**Phase 5 — Layer 5** HMS connector handlers. Rewire Pharmacy / Inventory / Diagnostics entry points to `openAiCore()`. Retire `UniversalScanner`, old `MobileScanView`, `MedicineInputBar` camera path (text + voice stay). Old edge fns kept one release for safety, then removed.

**Phase 6 — Memory** Generic `ai_corrections` table (kind, field, before, after, hospital_id, user_id) feeding back into extractor prompts.

## Out of scope

- Changing HMS business logic, schemas, billing math, RLS on existing tables.
- Offline mode.
- Replacing voice input or smart medicine search.
- Touching Auth, Patients, IPD, Day Care, Accounts, Staff.

## Confirmation needed

Reply **approve** and I will implement **Phase 1 (Layer 1 — Universal Upload Engine) only**, including the storage bucket, the mobile-first uploader, and the `/ai-core/test-upload` verification page. I will not touch any existing module in this phase.

Tell me if you want any layer reordered, dropped, or scoped differently before I start.