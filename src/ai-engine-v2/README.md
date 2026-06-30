# AI Engine V2 — Phase 1: MobileUploadEngine

Completely standalone. No dependency on Pharmacy, Inventory, Billing, OCR, AI,
routing, or the existing scanner code. Its only job is to capture / pick files
and upload them to the private `ai-core-uploads` bucket, returning file URL +
metadata via `onComplete`.

Test page: `/ai-engine-v2/test` (mobile-first, works on Android, iOS, desktop).

Phases 2–5 (OCR, AI Extraction, Verification, HMS Connector) will live as
sibling folders under `src/ai-engine-v2/` and will be built only after Phase 1
passes acceptance.