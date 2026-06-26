# Smart Universal Medicine Search

A Google-like, reusable medicine search component powering Pharmacy (OP/IP/Emergency), Inventory, Purchase, Billing, and Prescription modules — backed by a single shared search engine over the existing `medicines` table.

## Scope of this build

In-scope now:
- Reusable `<SmartMedicineSearch />` React component (command-palette style).
- Shared search engine (`src/modules/pharmacy/smartSearch.ts`) with fuzzy + partial + strength + brand/generic matching, ranking, highlighting, debouncing, keyboard nav, voice input (Web Speech API), barcode scan input.
- Personalised ranking via a new `medicine_search_usage` table (per-hospital, per-user frequency + recency) updated when a result is selected.
- Integration into the existing Pharmacy page search bar (Direct Sale + Patient flows) as the first consumer.
- Result card showing all listed fields that exist today; gracefully hide fields the schema doesn't have yet.

Out-of-scope (flagged for follow-up):
- Adding new columns to `medicines` for fields we don't store yet: `dosage_form`, `rack_location`, `selling_price`, `barcode`, `brand_name`, `salt_name`, `strength_value/unit`, `min_stock`, `is_active`. I'll add these in the migration so the UI has real data — see Technical section.
- Wiring the same component into Inventory / Purchase / Billing / Prescription pages — component will be exported and ready, but page-level wiring beyond Pharmacy is a follow-up to keep this PR reviewable.
- Cross-store stock view (needs multi-store inventory model; today inventory is single-hospital scoped). The "View Stock Across Stores" action will be present but show current-hospital stock only with a "coming soon" hint.

## User experience

```text
┌─ Search medicines… (⌘K) ──────────────────────[🎤] [📷]─┐
│  azi                                                     │
├──────────────────────────────────────────────────────────┤
│  Azithromycin 500 mg · Tablet           🟢 In Stock 240 │
│  Azithromycin · Azee · Strip(3) · Rack A-12 · ₹120      │
│  [Issue] [Details] [Alternatives] [Stock]               │
├──────────────────────────────────────────────────────────┤
│  Azithromycin 250 mg · Tablet           🟡 Low Stock 8  │
│  …                                                       │
└──────────────────────────────────────────────────────────┘
```

- Typing ≥2 chars triggers search (150 ms debounce, p95 target <200 ms).
- Arrow keys navigate, Enter selects, Esc closes, Tab cycles quick actions.
- Matching letters bolded in name + generic.
- Voice: Web Speech API (`webkitSpeechRecognition`) with mic toggle; falls back gracefully.
- Barcode: input mode that accepts scanner keyboard-wedge input (Enter-terminated) and exact-matches `barcode` field.
- Stock chip colour: green ≥ min_stock×2, amber > 0, red = 0.

## Ranking formula

```text
score = 1000·exactNameMatch
      +  600·prefixMatch(name|generic|brand)
      +  400·prefixMatch(strength)
      +  300·substringMatch
      +  200·fuzzy(score)          // Fuse.js threshold 0.3
      +   80·log(1+userPicks)      // personal recency/frequency
      +   40·log(1+hospitalPicks)  // hospital-wide popularity
      +   30·inStock               // stock > 0
      +   10·isGeneric
      -  500·expired
```

## Technical

### Database migration

New table for personalised ranking + new optional columns on `medicines`:

```sql
ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS salt_name text,
  ADD COLUMN IF NOT EXISTS strength text,           -- "500 mg"
  ADD COLUMN IF NOT EXISTS dosage_form text,        -- Tablet/Capsule/Syrup/Injection
  ADD COLUMN IF NOT EXISTS rack_location text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS selling_price numeric,
  ADD COLUMN IF NOT EXISTS min_stock integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS medicines_search_trgm
  ON public.medicines USING gin ((coalesce(name,'') || ' ' || coalesce(generic_name,'') || ' ' || coalesce(brand_name,'') || ' ' || coalesce(salt_name,'') || ' ' || coalesce(strength,'')) gin_trgm_ops);

CREATE TABLE public.medicine_search_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  user_id uuid NOT NULL,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  query text,
  picks integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, user_id, medicine_id)
);
-- standard GRANTs + RLS scoped to hospital_id via get_user_hospital_id(auth.uid())
```

Plus a `record_medicine_pick(_medicine_id uuid, _query text)` SECURITY DEFINER upsert.

### Frontend

- `src/modules/pharmacy/smartSearch.ts` — fetches medicines (cached via React Query, 60 s stale), runs Fuse.js fuzzy match in-worker-free memory, merges with usage stats, returns ranked results.
- `src/modules/pharmacy/useSmartMedicineSearch.ts` — hook: `{ query, setQuery, results, loading, pickMedicine }`.
- `src/components/pharmacy/SmartMedicineSearch.tsx` — cmdk-based popover; exposes `onSelect(medicine, action)` so each module decides what "Issue" means.
- `src/lib/highlightMatch.tsx` — tiny helper to bold matched chars.
- Integrate into `src/pages/Pharmacy.tsx` replacing the current medicine picker. Other modules get a one-liner import — wiring deferred.

### Performance

- Initial load: one `select` of active medicines (id, name, generic, brand, salt, strength, dosage_form, stock, min_stock, mrp, selling_price, batch_no, expiry_date, rack_location, barcode) cached client-side.
- For 100k+ medicines: switch the hook to server-side `rpc('search_medicines', …)` using the trigram index — added as a follow-up flag once the table grows past ~5k rows; current dataset fits comfortably in client memory.

## Deliverables

1. Migration (new columns, index, usage table, RPC).
2. Smart search engine + hook + reusable component.
3. Pharmacy page integration.
4. Voice + barcode input.
5. Personalised ranking via `record_medicine_pick`.

Follow-ups (not in this PR): wire into Inventory/Purchase/Billing/Prescription, multi-store stock view, server-side RPC mode for very large catalogs.
