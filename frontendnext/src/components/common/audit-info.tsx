// "Created By: Riya · Created On: 12 Nov 2026, 3:40 pm" — the standard who-did-it line for any record
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AuditRow {
  created_at?: string | null;
  created_by_name?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label}:</span> <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

export function AuditInfo({ row, className }: { row: AuditRow; className?: string }) {
  const changed = row.updated_at && row.updated_at !== row.created_at;
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
      <Item label="Created By" value={row.created_by_name ?? "—"} />
      <Item label="Created On" value={fmtDateTime(row.created_at)} />
      {changed && <Item label="Updated By" value={row.updated_by_name ?? "—"} />}
      {changed && <Item label="Updated On" value={fmtDateTime(row.updated_at)} />}
    </div>
  );
}

// Compact cell for tables: name on top, date underneath
export function AuditCell({ name, at }: { name?: string | null; at?: string | null }) {
  return (
    <div className="leading-tight">
      <div className="text-xs font-medium">{name ?? "—"}</div>
      <div className="text-2xs text-muted-foreground">{at ? fmtDateTime(at) : ""}</div>
    </div>
  );
}
