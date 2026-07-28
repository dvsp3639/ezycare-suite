import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospitalConfig } from "@/hooks/useHospitalConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronDown, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface SpecializationOption {
  id: string;
  name: string;
  hospital_id: string | null;
  is_global: boolean;
}

interface Props {
  selectedIds: string[];
  primaryId: string | null;
  onChange: (ids: string[], primaryId: string | null) => void;
}

export function DoctorSpecializationPicker({ selectedIds, primaryId, onChange }: Props) {
  const qc = useQueryClient();
  const { isHospitalAdmin, isSuperAdmin } = useAuth();
  const { hospitalId } = useHospitalConfig();
  const canCreate = isHospitalAdmin || isSuperAdmin;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: options = [], isLoading } = useQuery<SpecializationOption[]>({
    queryKey: ["specializations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specializations")
        .select("id, name, hospital_id, is_global")
        .order("name");
      if (error) throw error;
      return (data || []) as SpecializationOption[];
    },
  });

  const selectedOptions = useMemo(
    () => options.filter((o) => selectedIds.includes(o.id)),
    [options, selectedIds]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, search]);

  const exactMatch = useMemo(
    () => options.find((o) => o.name.toLowerCase() === search.trim().toLowerCase()),
    [options, search]
  );

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      if (!hospitalId) throw new Error("Hospital context missing");
      const { data, error } = await supabase
        .from("specializations")
        .insert({ name: name.trim(), hospital_id: hospitalId, is_global: false })
        .select("id, name, hospital_id, is_global")
        .single();
      if (error) throw error;
      return data as SpecializationOption;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["specializations"] });
      const next = [...selectedIds, created.id];
      onChange(next, primaryId ?? created.id);
      setSearch("");
      toast.success(`Added "${created.name}"`);
    },
    onError: (err: any) => toast.error(err?.message || "Could not create specialization"),
  });

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((x) => x !== id);
      const nextPrimary = primaryId === id ? next[0] ?? null : primaryId;
      onChange(next, nextPrimary);
    } else {
      const next = [...selectedIds, id];
      onChange(next, primaryId ?? id);
    }
  };

  const remove = (id: string) => {
    const next = selectedIds.filter((x) => x !== id);
    const nextPrimary = primaryId === id ? next[0] ?? null : primaryId;
    onChange(next, nextPrimary);
  };

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createMut.mutateAsync(name);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>Specializations <span className="text-destructive">*</span></Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal"
            >
              <span className="text-muted-foreground">
                {selectedIds.length === 0
                  ? "Search & select specializations"
                  : `${selectedIds.length} selected`}
              </span>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search specialization..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      <div className="p-2 text-sm text-muted-foreground">
                        No matches.
                        {canCreate && search.trim() && (
                          <div className="mt-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={handleCreate}
                              disabled={creating}
                              className="w-full"
                            >
                              {creating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                              Create "{search.trim()}"
                            </Button>
                          </div>
                        )}
                        {!canCreate && search.trim() && (
                          <div className="mt-2 text-xs">Only admins can add new specializations.</div>
                        )}
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {filtered.map((o) => {
                        const isSelected = selectedIds.includes(o.id);
                        return (
                          <CommandItem
                            key={o.id}
                            value={o.id}
                            onSelect={() => toggle(o.id)}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{o.name}</span>
                            {!o.is_global && (
                              <Badge variant="outline" className="ml-2 text-[10px]">Custom</Badge>
                            )}
                          </CommandItem>
                        );
                      })}
                      {canCreate && search.trim() && !exactMatch && filtered.length > 0 && (
                        <CommandItem
                          value={`__create__${search}`}
                          onSelect={handleCreate}
                          className="cursor-pointer text-primary"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create "{search.trim()}"
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <Badge
              key={o.id}
              variant={o.id === primaryId ? "default" : "secondary"}
              className="gap-1 pr-1"
            >
              {o.id === primaryId && <span className="text-[10px] font-semibold">★</span>}
              {o.name}
              <button
                type="button"
                onClick={() => remove(o.id)}
                className="ml-0.5 rounded-full hover:bg-background/40 p-0.5"
                aria-label={`Remove ${o.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {selectedOptions.length > 0 && (
        <div>
          <Label className="text-xs">Primary specialization</Label>
          <Select
            value={primaryId ?? ""}
            onValueChange={(v) => onChange(selectedIds, v)}
          >
            <SelectTrigger><SelectValue placeholder="Select primary" /></SelectTrigger>
            <SelectContent>
              {selectedOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}