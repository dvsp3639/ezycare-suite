# Super Admin: Subscriptions, AI Controls & Support Tickets

Three enterprise features added to `/super-admin`, plus a hospital-side Support inbox for admins.

## 1. Hospital Subscription Management

New table `hospital_subscriptions` (one-to-one with hospital):
- `plan` (enum: `trial`, `basic`, `professional`, `enterprise`)
- `status` (enum: `active`, `past_due`, `suspended`, `cancelled`, `trialing`)
- `billing_cycle` (`monthly` / `yearly`)
- `amount`, `currency` (INR default)
- `started_at`, `current_period_end`, `trial_ends_at`, `cancelled_at`
- `max_users`, `max_patients_per_month`, `features` (jsonb)
- `notes` (super admin only)

Super Admin UI (new "Subscriptions" tab):
- Table of all hospitals with plan, status badge, renewal date, MRR
- Edit dialog: change plan, extend period, suspend/reactivate, add notes
- Summary cards: total MRR, active/trial/suspended counts, upcoming renewals (30d)
- When status = `suspended` or `cancelled` → block hospital login server-side via `is_active` sync on `hospitals`

Hospital side: read-only banner on Dashboard when trial ending in ≤7 days or `past_due`.

## 2. AI Feature Toggle + Intelligence Monitoring

### Toggle
Add `ai_enabled boolean default true` to `hospitals` table.
- Super Admin: switch in Subscriptions row + dedicated "AI Controls" tab.
- Client: new hook `useAIEnabled()` reads it once at login; feature flags:
  - Universal AI Search, AI Scanner (Pharmacy/Inventory/Diagnostics), Voice input, Prescription scanner, Purchase invoice extraction.
- When off: hide AI buttons across the app, show "AI disabled by administrator — use manual entry" tooltip. Edge functions (`medicine-scan-ai`, `prescription-scan-ai`, `universal-ai-search`, `voice-transcribe`) reject calls with 403 after checking hospital flag.

### Intelligence Monitoring
New table `ai_usage_events`:
- `hospital_id`, `user_id`, `feature` (enum: prescription_scan, invoice_scan, universal_search, voice_transcribe, medicine_scan)
- `model`, `tokens_in`, `tokens_out`, `latency_ms`
- `status` (`success`/`error`/`low_confidence`)
- `confidence_score` numeric, `was_corrected` boolean, `correction_delta` jsonb
- `created_at`

All 4 edge functions log one row per invocation (fire-and-forget insert). Existing correction tables (`prescription_corrections`, `scanner_corrections`) already track manual overrides — we backfill by joining on time proximity.

Super Admin "AI Monitoring" tab per hospital:
- KPI cards: total calls (7d/30d), success rate, avg confidence, correction rate, avg latency, credits est.
- Charts (recharts): calls/day stacked by feature, accuracy trend, top corrected medicine names.
- Feature breakdown table.
- Export CSV.

## 3. Customer Support Tickets

New tables:
- `support_tickets`: `id`, `hospital_id`, `created_by`, `subject`, `category` (enum: bug, feature, billing, ai, training, other), `priority` (low/medium/high/urgent), `status` (open, in_progress, waiting_customer, resolved, closed), `assigned_to` (super admin uuid), `first_response_at`, `resolved_at`, `sla_due_at`, timestamps.
- `support_ticket_messages`: `ticket_id`, `sender_id`, `sender_role` (hospital / super_admin), `body` text, `attachments` jsonb (storage paths), `internal_note` boolean (super admin only), `created_at`.
- Storage bucket `support-attachments` (private, RLS by ticket → hospital scope).

RLS:
- Hospital admins: see/create tickets for their own hospital, reply to their own tickets, cannot see `internal_note = true` messages.
- Super admin: full access, can set status/priority/assignee, post internal notes.

### Hospital side ("Support" module in sidebar for admin role)
- Ticket list (status filter, search)
- New ticket form (subject, category, priority, description, attach files)
- Ticket thread view: chronological messages, reply box, status pill, "Reopen" if resolved
- Notification badge on sidebar for unread replies

### Super Admin side (new "Support" tab)
- Ticket queue with filters (status, priority, hospital, assignee, SLA)
- Ticket detail: reply, internal note toggle, change status/priority/assignee, hospital context sidebar (plan, AI status, recent activity)
- SLA rules: urgent 2h, high 8h, medium 24h, low 72h — computed on create
- Dashboard KPIs: open count, breached SLA, avg first response, CSAT (optional post-close 1-5 rating in a follow-up)

## Files

**Migrations (one file)**
- `hospital_subscriptions` + `hospitals.ai_enabled` + `ai_usage_events` + `support_tickets` + `support_ticket_messages` + storage bucket + RLS + GRANTs + `has_role('super_admin')` policies.

**Edge functions**
- Update `medicine-scan-ai`, `prescription-scan-ai`, `universal-ai-search`, `voice-transcribe`: check `hospitals.ai_enabled`, log `ai_usage_events`.
- Extend `admin-api`: subscriptions CRUD, ai monitoring aggregate endpoint, tickets CRUD.

**Frontend**
- `src/pages/SuperAdminConsole.tsx`: add tabs Subscriptions, AI Monitoring, Support (extract subcomponents into `src/components/superadmin/`).
- `src/components/superadmin/SubscriptionsTab.tsx`
- `src/components/superadmin/AIMonitoringTab.tsx` (uses recharts)
- `src/components/superadmin/SupportTab.tsx` + `SupportTicketDetail.tsx`
- `src/pages/Support.tsx` (hospital admin)
- `src/hooks/useAIEnabled.ts` + wire into `UniversalSearch`, `MedicineInputBar`, `PurchaseInvoiceRepository`, prescription scanner, voice input to hide/disable when false.
- `src/data/modules.ts` + `AppSidebar.tsx`: add "Support" entry for admins.

## Rollout order
1. Migration (schema + RLS + bucket).
2. admin-api endpoints.
3. Super Admin UI tabs.
4. AI toggle enforcement (client + edge functions) & usage logging.
5. Hospital Support page + notifications.

Scope note: no payment gateway integration in this pass — subscription state is managed manually by super admin. Stripe/Razorpay hookup can be a later phase.
