import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMedicines } from "./hooks";
import { buildIndex, searchMedicines, type RankedMedicine, type UsageStat } from "./smartSearch";
import type { Medicine } from "./types";

/**
 * Universal smart medicine search hook.
 * - Caches medicines & usage stats client-side
 * - Debounces query (120ms) for sub-200ms feel
 * - Returns ranked results + helpers to record picks
 */
export function useSmartMedicineSearch(opts?: { debounceMs?: number; limit?: number }) {
  const { debounceMs = 120, limit = 20 } = opts || {};
  const { data: medicines = [] } = useMedicines();

  const { data: usageRows = [], refetch: refetchUsage } = useQuery({
    queryKey: ["medicine_search_usage", "self"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicine_search_usage")
        .select("medicine_id, picks, last_used_at");
      if (error) throw error;
      return data as Array<{ medicine_id: string; picks: number; last_used_at: string }>;
    },
    staleTime: 30_000,
  });

  const usageMap = useMemo(() => {
    const m = new Map<string, UsageStat>();
    for (const r of usageRows) {
      m.set(r.medicine_id, {
        medicineId: r.medicine_id,
        picks: r.picks,
        lastUsedAt: r.last_used_at,
      });
    }
    return m;
  }, [usageRows]);

  const fuse = useMemo(() => buildIndex(medicines as Medicine[]), [medicines]);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setDebounced(query), debounceMs);
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [query, debounceMs]);

  const results: RankedMedicine[] = useMemo(() => {
    if (debounced.trim().length === 0) return [];
    if (debounced.trim().length < 2) return [];
    return searchMedicines(debounced, medicines as Medicine[], fuse, usageMap, limit);
  }, [debounced, medicines, fuse, usageMap, limit]);

  const pickMedicine = async (medicineId: string) => {
    try {
      await supabase.rpc("record_medicine_pick" as any, {
        _medicine_id: medicineId,
        _query: debounced || null,
      });
      refetchUsage();
    } catch {
      /* non-fatal */
    }
  };

  return { query, setQuery, results, pickMedicine, medicines: medicines as Medicine[] };
}