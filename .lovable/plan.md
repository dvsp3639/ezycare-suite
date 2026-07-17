## Doctor Availability Engine — Implementation Plan

Replace the current "Manage Slots" popup in Clinic Management with a full **Doctor Availability Engine** while preserving EzyOp's existing sidebar, header, teal theme, typography, and shadcn component library.

### Scope
Only the slot-management surface inside `src/pages/ClinicManagement.tsx` changes. All other modules, routes, and design tokens remain untouched.

### 1. Database (single migration)
New tables (all hospital-scoped, RLS by `hospital_id` via `get_user_hospital_id`, GRANT to authenticated + service_role):

- `doctor_weekly_schedules` — doctor_id, day_of_week (0–6), is_working, notes
- `doctor_op_sessions` — weekly_schedule_id, session_name, start_time, end_time, slot_duration_min, buffer_min, token_capacity, max_online, max_walkin, consultation_fee, booking_window_days, online_enabled, walkin_enabled
- `doctor_daily_overrides` — doctor_id, override_date, override_type (custom/closed/half-day), sessions jsonb, reason
- `doctor_leaves` — doctor_id, from_date, to_date, leave_type (single/half/vacation/conference/emergency), half_day_period, reason, status
- `hospital_holidays` — holiday_date, name, is_recurring_yearly
- `doctor_live_status` — doctor_id, status (available/late/consulting/in_ot/emergency/closed/leave), delay_minutes, message, updated_at

Extend existing `doctor_schedules` + `time_slots` as the **materialized** day view generated from weekly schedule + overrides + leaves + holidays (server-side generator function `generate_doctor_slots(doctor_id, date)`).

### 2. UI — Replace "Manage Slots" dialog
New component `src/components/clinic/DoctorAvailabilityEngine.tsx` opened in a large Sheet from the doctor card. Tabs (using existing shadcn Tabs):

1. **Weekly Schedule** — 7-day grid; per-day toggle Working/Off; add multiple OP sessions per day with time, duration, capacity, fees, online/walk-in toggles.
2. **7-Day Calendar** — cards for today + next 6 days showing sessions, available/booked/blocked counts, live status chip; actions Edit / Pause / Resume / Close / Duplicate.
3. **Live Status** — one-click chips (Available / Running Late +N min / Consulting / In OT / Emergency / OP Closed / On Leave) writing to `doctor_live_status`.
4. **Leave Management** — list + add leave (single/half/range/recurring); auto-blocks affected days.
5. **Holidays** — hospital holiday calendar (add / recurring yearly).
6. **Appointment & Queue Rules** — buffer, lunch break, max online, max walk-ins, booking window.
7. **Exceptions (Daily Override)** — pick date → override times/close/half-day without touching weekly template.
8. **Analytics** — today's OP status: available, late, in OT, on leave, waiting patients, bookings, walk-ins, completion rate, avg wait (reads existing appointments).

Bulk actions bar: Copy Monday→Weekdays, Copy Today, Copy This Week→Next Week.

### 3. Slot generation
`clinicService.generateSlotsForRange(doctorId, fromDate, toDate)` computes materialized `doctor_schedules` + `time_slots` rows from weekly template minus leaves/holidays/overrides. Runs:
- On weekly schedule save (regenerates next 7 days)
- On override/leave/holiday change (regenerates affected dates)
- Nightly-safe: idempotent upsert keyed by (doctor_name, schedule_date)

Existing booking flow (`OP Queue`) continues reading `doctor_schedules` + `time_slots`, so no downstream changes.

### 4. Live sync
Enable Realtime on `doctor_live_status`, `time_slots`, `doctor_schedules`. `ClinicDataContext` subscribes and refreshes queue + status chips. Patient/Partner apps (future) read the same tables.

### 5. Design system compliance
- All colors via existing tokens (`--primary` teal, status semantic tokens); no hardcoded hex.
- Reuse Card, Tabs, Sheet, Dialog, Badge, Button, Calendar, Popover, Select, Switch, Input.
- Sidebar, header, typography untouched.
- Status colors mapped to existing semantic tokens (success/warning/destructive/info/muted).

### Technical notes
- Data isolation via `hospital_id` + RLS on every new table.
- `dd/mm/yyyy` date display via `date-fns` `format(d, "dd/MM/yyyy")`.
- All new UI in `src/pages/ClinicManagement.tsx` + `src/components/clinic/*`; services in `src/modules/clinic/availability.ts`; hooks in `src/modules/clinic/availabilityHooks.ts`.
- Old "Manage Slots" dialog code removed; existing `TimeSlotPicker` retained for booking-side use.
- Future-ready: sessions table already carries `booking_window_days`, `online_enabled` — teleconsult/multi-branch can add columns without redesign.

### Delivery order
1. Migration (new tables + RLS + GRANTs + generator function).
2. Services + hooks (`availability.ts`, `availabilityHooks.ts`).
3. `DoctorAvailabilityEngine` component with all 8 tabs.
4. Wire into `ClinicManagement.tsx`, remove old Manage Slots dialog.
5. Realtime subscriptions in `ClinicDataContext`.
6. Verify: build passes, Playwright open engine → set weekly schedule → verify slots appear on OP Queue.

Ready to proceed?