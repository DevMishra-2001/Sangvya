"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { isoDate } from "@/lib/format";
import { selfService } from "@/lib/services/self";
import type { AttendanceDayResponse, PunchGeo } from "@/lib/types";
import { LOCATION_LABELS } from "@/lib/constants";
import { PunchProof } from "./punch-proof";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";

// "11:35:36"
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour12: false }) : "00:00:00");
// seconds → "01:12:36"
const hms = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
const secondsBetween = (a: string, b: string | Date) => (new Date(b).getTime() - new Date(a).getTime()) / 1000;

function Section({ title, right, footer, children }: { title: string; right?: string; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-3 overflow-hidden rounded-lg border text-sm">
      <div className="flex items-center justify-between border-b bg-primary/8 px-3 py-1.5">
        <h3 className="text-xs font-semibold">{title}</h3>
        {right && <span className="text-xs font-semibold">{right}</span>}
      </div>
      {children}
      <div className="border-t px-3 py-1.5 text-right text-xs font-semibold">{footer}</div>
    </section>
  );
}

// Opened from the header timer: a day's breaks and in/out punches, to the second.
export function PunchDetailsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [date, setDate] = useState(() => isoDate(new Date()));
  // The last result, for the date it was loaded for (a different date = loading)
  const [result, setResult] = useState<{ date: string; data?: AttendanceDayResponse; error?: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    selfService
      .attendanceDay(date)
      .then((data) => !cancelled && setResult({ date, data }))
      .catch((err) => !cancelled && setResult({ date, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [open, date]);

  const current = result?.date === date ? result : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;

  // Keep an open session's running time current
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const day = data?.day;
  const isToday = data?.date === data?.today;
  // An open session/break on a past day is measured to its last punch, not "now"
  const endOf = (iso: string | null) => iso || (isToday ? now : day?.punchOut || null);

  const breaks = (day?.breaks ?? []).map((b, i) => {
    const end = endOf(b.end);
    return { key: i, in: clock(b.start), out: clock(b.end), seconds: end ? secondsBetween(b.start, end) : 0 };
  });
  const sessions = (day?.sessions ?? []).map((s, i) => {
    const end = endOf(s.out);
    return {
      key: i,
      in: clock(s.in),
      out: clock(s.out),
      seconds: end ? secondsBetween(s.in, end) : 0,
      inExtra: <PunchMeta mode={s.inLocation} remarks={s.inRemarks} photo={s.inPhoto} geo={s.inGeo} label={`In ${i + 1}`} />,
      outExtra: s.out ? <PunchMeta mode={s.outLocation} remarks={s.outRemarks} photo={s.outPhoto} geo={s.outGeo} label={`Out ${i + 1}`} /> : null,
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Punch details</DialogTitle>
          <DialogDescription>
            {data ? `${data.employee.name}${data.employee.code ? ` · ${data.employee.code}` : ""}` : "Breaks and check-ins for a day"}
          </DialogDescription>
        </DialogHeader>

        <FormField label="Date" htmlFor="pd-date" className="w-48">
          <DatePicker id="pd-date" value={date} onChange={setDate} max={isoDate(new Date())} />
        </FormField>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Section title="Breaks" right={`Count: ${breaks.length}`} footer={<>Total break: <span className="text-destructive tabular-nums">{hms(breaks.reduce((s, r) => s + r.seconds, 0))}</span></>}>
              <PunchTable rows={breaks} inLabel="Break start" outLabel="Break end" empty="No breaks on this day." />
            </Section>
            <Section title="In / Out" footer={<>Total working: <span className="text-destructive tabular-nums">{hms(sessions.reduce((s, r) => s + r.seconds, 0))}</span></>}>
              <PunchTable rows={sessions} inLabel="In" outLabel="Out" empty="No punches on this day." />
            </Section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Work mode, remarks, selfie and map pin under a punch time
function PunchMeta({ mode, remarks, photo, geo, label }: { mode: string | null; remarks: string | null; photo: string | null; geo: PunchGeo | null; label: string }) {
  if (!mode && !remarks && !photo && !geo) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <PunchProof photo={photo} geo={geo} label={label} />
      {mode && <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{LOCATION_LABELS[mode] ?? mode}</span>}
      {remarks && <span className="max-w-40 truncate" title={remarks}>{remarks}</span>}
    </div>
  );
}

interface PunchRow {
  key: number;
  in: string;
  out: string;
  seconds: number;
  inExtra?: React.ReactNode;
  outExtra?: React.ReactNode;
}

function PunchTable({ rows, inLabel, outLabel, empty }: { rows: PunchRow[]; inLabel: string; outLabel: string; empty: string }) {
  if (rows.length === 0) return <p className="px-3 py-3 text-xs text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>{inLabel}</TableHead>
          <TableHead>{outLabel}</TableHead>
          <TableHead className="text-right">Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={r.key}>
            <TableCell>{i + 1}</TableCell>
            <TableCell className="align-top tabular-nums">
              {r.in}
              {r.inExtra}
            </TableCell>
            <TableCell className="align-top tabular-nums">
              {r.out}
              {r.outExtra}
            </TableCell>
            <TableCell className="text-right tabular-nums">{hms(r.seconds)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
