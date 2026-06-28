
## Goal

Replace the current `PrescriptionScanner` modal with a **Pharmacy Workspace** — a per-user, real-time synced workflow where a pharmacist starts a prescription on mobile and seamlessly continues (or finishes) on desktop, WhatsApp-Web style.

## Stages (single state machine per scan)

`scan → ai_extraction → inventory_match → review → billing → payment → deducted → audit`

Each scan row carries `stage`, `status`, `verification_status`, `billing_status`, plus full payload (patient, doctor, items, totals, payment).

## Data model

New table `pharmacy_workspace_scans` (per-user private queue):

```text
id, hospital_id, owner_user_id (= scanner)
stage, verification_status, billing_status
patient_json, doctor_json, items_json, totals_json, payment_json
ai_confidence, page_count, source_files (urls)
created_at, updated_at, completed_at, cancelled_at
linked_order_id (pharmacy_orders.id once billed)
```

- RLS: only `owner_user_id = auth.uid()` can read/update; service_role full.
- Added to `supabase_realtime` publication for live sync.
- Stays in queue **Until completed or cancelled** (no auto-archive).

## Real-time sync

- Single Supabase Realtime channel per user: `workspace:{user_id}`.
- All edits write the full updated payload back to the row. Optimistic UI + last-write-wins with `updated_at`.
- `useWorkspaceQueue()` hook subscribes for the list; `useWorkspaceScan(id)` subscribes for one scan and merges remote updates into local form state.

## UI

**Entry point — `/pharmacy` → "Workspace" tab (default)**

Live queue table/cards showing: Patient · Scan time · AI confidence · # medicines · Verification · Billing · Stage badge · Resume button.

**Mobile layout (`< md`)**
- Big "Scan Prescription" FAB
- Queue as stacked cards
- Stage screens are full-screen sheets, one stage per screen, large touch targets
- Full workflow available end-to-end (scan → payment → receipt)

**Desktop layout (`≥ md`)**
- Two-pane: left = live queue list, right = active scan detail with all stages as a vertical stepper, edit-rich tables, keyboard shortcuts
- Receives mobile scans instantly (toast + queue badge)

Both layouts render from the **same** `WorkspaceScanProvider` so any field edit syncs immediately.

## Stage components (shared)

1. **ScanStage** — reuses existing `docScan.ts` multi-page capture; uploads pages to `prescriptions` bucket; creates row with `stage=ai_extraction`.
2. **AIExtractionStage** — calls existing `prescription-scan-ai` edge function; writes patient/doctor/items + confidence.
3. **InventoryMatchStage** — auto-matches against `medicines` (existing fuzzy logic); flags available/low/out.
4. **ReviewStage** — pharmacist fills gaps, picks transaction type (OP/IP/Direct/Return), resolves patient.
5. **BillingStage** — line items, discount, GST, totals (same math as Pharmacy.tsx).
6. **PaymentStage** — mode (Cash/UPI/Card), amount tendered, change.
7. **DeductionStage** — calls existing `create_pharmacy_sale` RPC; stores `linked_order_id`; sets `stage=audit`.
8. **AuditStage** — read-only summary, print/share receipt, "Done" → marks completed.

## File changes

**New**
- `supabase/migrations/*_pharmacy_workspace.sql` — table + RLS + grants + realtime publication
- `src/modules/pharmacy/workspace/types.ts`
- `src/modules/pharmacy/workspace/service.ts` — CRUD + RPC wrappers
- `src/modules/pharmacy/workspace/hooks.ts` — `useWorkspaceQueue`, `useWorkspaceScan`
- `src/components/pharmacy/workspace/WorkspaceQueue.tsx`
- `src/components/pharmacy/workspace/WorkspaceScan.tsx` (responsive container)
- `src/components/pharmacy/workspace/stages/*.tsx` (8 stage components, mostly extracted from existing `PrescriptionScanner.tsx`)

**Modified**
- `src/pages/Pharmacy.tsx` — replace PrescriptionScanner CTA with Workspace tab as default
- `src/components/pharmacy/PrescriptionScanner.tsx` — **deleted** (logic moved into stages)

## Out of scope

- Multi-pharmacist shared queues (per your answer: private per user)
- Auto-archive / shift cutoffs
- Offline mode (mobile requires connectivity for sync)

## Implementation order

1. Migration (table, RLS, realtime).
2. Service + hooks + provider.
3. Stage components extracted from existing scanner.
4. Responsive WorkspaceScan + WorkspaceQueue.
5. Wire into `Pharmacy.tsx`, delete old scanner.
6. Manual sync test: open preview on desktop, scan on mobile viewport — confirm row appears live.

Reply **approve** to proceed, or tell me what to change.
