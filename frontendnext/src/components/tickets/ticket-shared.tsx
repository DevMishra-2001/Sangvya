"use client";

// Small pieces shared by the ticket pages: coloured badges, colour picker, file picker, due-date chip
import { useRef, useState } from "react";
import { CalendarClock, FileUp, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { fmtDate } from "@/lib/format";
import { ticketsService, type Attachment, type StatusKind } from "@/lib/services/tickets";
import { cn } from "@/lib/utils";

export const KIND_LABEL: Record<StatusKind, string> = {
  open: "Open (not started)",
  active: "Working on it",
  hold: "On hold",
  review: "In review / UAT",
  done: "Done",
  closed: "Closed",
};

export const SWATCHES = ["#2563eb", "#0891b2", "#0d9488", "#16a34a", "#65a30d", "#ca8a04", "#f59e0b", "#ea580c", "#dc2626", "#db2777", "#7c3aed", "#475569"];

// "1h 30m", "45m"
export const mins = (m: number | null | undefined) => {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
};

// Pill tinted with the row's own colour (status, priority, category)
export function ColorBadge({ color, children, className, dot }: { color?: string | null; children: React.ReactNode; className?: string; dot?: boolean }) {
  const c = color ?? "#64748b";
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap", className)}
      style={{ backgroundColor: `${c}1a`, borderColor: `${c}40`, color: c }}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />}
      {children}
    </span>
  );
}

// Delivery date with a red tint when late
export function DueChip({ date, delayed, className }: { date: string | null; delayed?: boolean; className?: string }) {
  if (!date) return <span className={cn("text-xs text-muted-foreground", className)}>No date</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", delayed ? "font-semibold text-destructive" : "text-muted-foreground", className)}>
      <CalendarClock className="size-3" />
      {fmtDate(date)}
    </span>
  );
}

// Swatches + any colour
export function ColorPicker({ value, onChange, id }: { value: string; onChange: (c: string) => void; id?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          onClick={() => onChange(c)}
          className={cn("size-6 rounded-full border-2 transition-transform hover:scale-110", value.toLowerCase() === c ? "border-foreground" : "border-transparent")}
          style={{ backgroundColor: c }}
        />
      ))}
      <label className="relative flex size-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border text-2xs text-muted-foreground" title="Any colour">
        +
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <span className="ml-1 font-mono text-xs text-muted-foreground uppercase">{value}</span>
    </div>
  );
}

export function TicketFilePicker({ files, onChange, disabled }: { files: Attachment[]; onChange: (f: Attachment[]) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const added: Attachment[] = [];
    for (const f of Array.from(list).slice(0, 10 - files.length)) {
      const r = await run(() => ticketsService.upload(f));
      if (r.ok) added.push(r.data);
    }
    setBusy(false);
    onChange([...files, ...added]);
    if (ref.current) ref.current.value = "";
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" className="hidden" onChange={(e) => pick(e.target.files)} />
      <Button type="button" variant="secondary" size="sm" disabled={disabled || busy || files.length >= 10} onClick={() => ref.current?.click()}>
        {busy ? <Spinner /> : <FileUp />} Attach file
      </Button>
      {files.map((f, i) => (
        <span key={f.path} className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
          <Paperclip className="size-3" /> <span className="max-w-40 truncate">{f.name}</span>
          {!disabled && (
            <button type="button" aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => onChange(files.filter((_, j) => j !== i))}>
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
