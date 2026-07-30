import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { CalendarCheck, CheckCircle2, Clock, XCircle } from "lucide-react";
import { daysLeft, formatIndian, type FollowupEntitlement } from "@/modules/followup/types";

interface Props {
  entitlement: FollowupEntitlement;
  hospitalName?: string;
  onBook?: (date: string) => Promise<void> | void;
  compact?: boolean;
}

export function EligibilityCard({ entitlement: e, hospitalName, onBook, compact }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const left = daysLeft(e.expiry_date);
  const eligible = e.status === "active" && left >= 0 && e.used_visits < e.max_visits;

  return (
    <div
      className={`rounded-xl border p-4 ${
        eligible ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {eligible ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <p className="font-semibold text-sm">
              {eligible ? "Eligible for Free Follow-up" : `Follow-up ${e.status}`}
            </p>
          </div>
          <p className="text-sm mt-1 font-medium truncate">
            {e.patient_name} <span className="text-muted-foreground">· {e.registration_number || "No UHID"}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hospitalName ? `${hospitalName} · ` : ""}Dr. {e.doctor_name}
            {e.department ? ` · ${e.department}` : ""}
          </p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Expires {formatIndian(e.expiry_date)}
            </Badge>
            <Badge variant={left >= 0 ? "secondary" : "destructive"}>
              {left >= 0 ? `${left} day${left === 1 ? "" : "s"} remaining` : "Window closed"}
            </Badge>
            <Badge variant="outline">
              Visits {e.used_visits}/{e.max_visits}
            </Badge>
            <Badge variant="outline">Original OP {formatIndian(e.source_visit_date)}</Badge>
            {!e.consent && <Badge variant="destructive">No reminder consent</Badge>}
          </div>
        </div>

        {eligible && onBook && !compact && (
          <div className="flex items-end gap-2">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Follow-up date</p>
              <DateInput value={date} onChange={setDate} className="w-36 h-9" />
            </div>
            <Button
              size="sm"
              disabled={busy || !date}
              onClick={async () => {
                setBusy(true);
                try {
                  await onBook(date);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <CalendarCheck className="h-4 w-4 mr-1" /> Book Free Token
            </Button>
          </div>
        )}
      </div>
      {eligible && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Consultation fee is waived automatically as per hospital policy. The visit is marked as a follow-up and
          linked to the original OP.
        </p>
      )}
    </div>
  );
}