import Fuse from "fuse.js";
import type { Medicine } from "./types";

export interface UsageStat {
  medicineId: string;
  picks: number;
  lastUsedAt: string;
}

export interface RankedMedicine {
  medicine: Medicine;
  score: number;
  stockStatus: "in" | "low" | "out";
  expired: boolean;
}

const normalize = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Build a Fuse index. Re-use across keystrokes. */
export function buildIndex(medicines: Medicine[]) {
  return new Fuse(medicines, {
    includeScore: true,
    threshold: 0.38,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: "name", weight: 0.4 },
      { name: "genericName", weight: 0.25 },
      { name: "brandName", weight: 0.15 },
      { name: "saltName", weight: 0.1 },
      { name: "strength", weight: 0.05 },
      { name: "category", weight: 0.03 },
      { name: "manufacturer", weight: 0.02 },
    ],
  });
}

export function stockStatus(med: Medicine): "in" | "low" | "out" {
  const stock = med.stock || 0;
  const min = med.minStock || 10;
  if (stock <= 0) return "out";
  if (stock < min) return "low";
  return "in";
}

export function isExpired(med: Medicine): boolean {
  if (!med.expiryDate) return false;
  return new Date(med.expiryDate).getTime() < Date.now();
}

/** Score a single medicine against a query, combining fuzzy + heuristics + usage. */
function scoreMedicine(
  med: Medicine,
  query: string,
  fuseScore: number | undefined,
  usage: Map<string, UsageStat>,
): number {
  const q = normalize(query);
  const name = normalize(med.name);
  const generic = normalize(med.genericName);
  const brand = normalize(med.brandName);
  const salt = normalize(med.saltName);
  const strength = normalize(med.strength);

  let score = 0;

  if (name === q || generic === q || brand === q) score += 1000;
  if (name.startsWith(q) || generic.startsWith(q) || brand.startsWith(q)) score += 600;
  if (strength.startsWith(q)) score += 400;
  if (name.includes(q) || generic.includes(q) || brand.includes(q) || salt.includes(q)) score += 300;

  if (fuseScore !== undefined) {
    // Fuse score: 0 perfect, 1 worst
    score += Math.round((1 - fuseScore) * 200);
  }

  const u = usage.get(med.id);
  if (u) {
    score += Math.round(80 * Math.log(1 + u.picks));
    const daysAgo = Math.max(
      0,
      (Date.now() - new Date(u.lastUsedAt).getTime()) / 86_400_000,
    );
    score += Math.max(0, 40 - Math.round(daysAgo)); // recency boost
  }

  if ((med.stock || 0) > 0) score += 30;
  if (med.genericName && !med.brandName) score += 10;
  if (isExpired(med)) score -= 500;

  return score;
}

export function searchMedicines(
  query: string,
  medicines: Medicine[],
  fuse: Fuse<Medicine>,
  usage: Map<string, UsageStat>,
  limit = 20,
): RankedMedicine[] {
  const q = query.trim();
  if (!q) {
    // Empty query: surface top recent/frequent
    const ranked = medicines
      .map((m) => ({
        medicine: m,
        score: scoreMedicine(m, "", undefined, usage),
        stockStatus: stockStatus(m),
        expired: isExpired(m),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return ranked;
  }

  // Barcode exact match shortcut
  const exactBarcode = medicines.find(
    (m) => m.barcode && normalize(m.barcode) === normalize(q),
  );
  if (exactBarcode) {
    return [
      {
        medicine: exactBarcode,
        score: 9999,
        stockStatus: stockStatus(exactBarcode),
        expired: isExpired(exactBarcode),
      },
    ];
  }

  const hits = fuse.search(q, { limit: limit * 3 });
  const seen = new Set<string>();
  const ranked: RankedMedicine[] = [];

  for (const h of hits) {
    if (seen.has(h.item.id)) continue;
    seen.add(h.item.id);
    ranked.push({
      medicine: h.item,
      score: scoreMedicine(h.item, q, h.score, usage),
      stockStatus: stockStatus(h.item),
      expired: isExpired(h.item),
    });
  }

  // Also include prefix matches that Fuse may have missed
  const qn = normalize(q);
  for (const m of medicines) {
    if (seen.has(m.id)) continue;
    if (
      normalize(m.name).startsWith(qn) ||
      normalize(m.genericName).startsWith(qn) ||
      normalize(m.brandName).startsWith(qn)
    ) {
      seen.add(m.id);
      ranked.push({
        medicine: m,
        score: scoreMedicine(m, q, 0.1, usage),
        stockStatus: stockStatus(m),
        expired: isExpired(m),
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}