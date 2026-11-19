"use client";

// Ticket Calendar: an employee's month — tickets due each day and time logged — with a project-wise summary.
// Click a day to see its tickets; open one to change status or reassign.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Clock, Gauge, Timer } from "lucide-react";
import { FormHeading } from "@/components/common/form-layout";
import { MonthPicker } from "@/components/common/month-picker";
import { SelectField } from "@/components/common/select-field";
import { StatTile } from "@/components/common/stat-tile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate, isoDate, toMonth } from "@/lib/format";
import { ticketsService, type CalendarData, type CalendarTicket } from "@/lib/services/tickets";
import { cn } from "@/lib/utils";
import { useTicketMeta } from "@/stores/ticket-meta-store";
import { ColorBadge, mins } from "./ticket-shared";
import { TicketSheet } from "./ticket-sheet";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Day = CalendarData["days"][number];

function TicketLine({ t, extra, onOpen }: { t: CalendarTicket; extra?: React.ReactNode; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm hover:bg-muted/50" style={{ borderLeft: `3px solid ${t.status_color}` }}>
      <span className="font-mono text-xs font-semibold text-primary">{t.code}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{t.title}</span>
        {t.project_name && <span className="block truncate text-2xs text-muted-foreground">{t.project_name}</span>}
      </span>
      {t.delayed && <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-label="Delayed" />}
      <ColorBadge color={t.status_color} dot>
        {t.status_name}
      </ColorBadge>
      {extra}
    </button>
  );
}

// Count chips inside a day cell
function DayChips({ d }: { d: Day | undefined }) {
  if (!d) return null;
  const late = d.due.some((t) => t.delayed);
  return (
    <div className="flex flex-col items-center gap-1">
      {d.due.length > 0 && (
        <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", late ? "bg-destructive/12 text-destructive" : "bg-primary/12 text-primary")}>
          Due: {d.due.length}
        </span>
      )}
      {d.minutes > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-success/12 px-2 py-0.5 text-2xs font-semibold text-success">
          <Clock className="size-3" /> {mins(d.minutes)}
        </span>
      )}
    </div>
  );
}

export function CalendarView() {
  const url = useUrlParams();
  const loadMeta = useTicketMeta((s) => s.load);
  const meta = useTicketMeta((s) => s.meta);
  const month = url.get("month", toMonth(new Date()));
  const employee = url.getNumber("employee", 0) || undefined;
  const openId = url.getNumber("id", 0) || null;
  const [data, setData] = useState<CalendarData | null>(null);
  const [version, setVersion] = useState(0);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);
  useEffect(() => {
    let cancelled = false;
    run(() => ticketsService.calendar(month, employee)).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, [month, employee, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const closeSheet = useCallback(() => url.set({ id: null }), [url]);

  if (!data) return <Skeleton className="h-[70vh] rounded-xl" />;

  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1)).getUTCDay();
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const today = isoDate(new Date());
  const picked = day ? byDate.get(day) : undefined;
  const open = (id: number) => {
    setDay(null);
    url.set({ id });
  };
  const listLink = (projectId: number | null, view?: string) =>
    `/tickets?scope=all&assignedTo=${data.employee.id}${projectId ? `&projectId=${projectId}` : ""}${view ? `&view=${view}` : ""}`;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title="Ticket Calendar" icon={CalendarDays} />
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          {data.people.length > 1 && (
            <SelectField
              className="w-full sm:w-60"
              value={String(data.employee.id)}
              onValueChange={(v) => url.set({ employee: Number(v) === meta?.me.employeeId ? null : v })}
              searchable
              aria-label="Employee"
              options={data.people.map((p) => ({ value: String(p.id), label: p.name }))}
            />
          )}
          <MonthPicker className="w-full sm:w-44" value={month} onChange={(v) => url.set({ month: v === toMonth(new Date()) ? null : v })} allowFuture aria-label="Month" />
        </div>
        <div className="grid grid-cols-2 gap-2 px-3 pb-3 lg:grid-cols-4">
          <StatTile icon={CalendarDays} value={data.tiles.workingDays} label="Working days" />
          <StatTile icon={Timer} value={mins(data.tiles.totalMinutes)} label="Time logged" tone="bg-success/15 text-success" />
          <StatTile icon={Clock} value={data.tiles.daysWorked} label="Days logged" tone="bg-info/15 text-info" />
          <StatTile icon={Gauge} value={mins(data.tiles.avgMinutesPerDay)} label="Avg per day" tone="bg-warning/15 text-warning" />
        </div>
      </section>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Month grid (tablet / desktop) */}
        <section className="hidden overflow-hidden rounded-xl border bg-card sm:block">
          <div className="grid grid-cols-7 border-b bg-primary/5 text-center text-xs font-semibold text-primary">
            {WEEK.map((w) => (
              <div key={w} className="py-2">
                <span className="hidden lg:inline">{w}</span>
                <span className="lg:hidden">{w.slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((iso, i) => {
              const d = iso ? byDate.get(iso) : undefined;
              const busy = Boolean(d && (d.due.length || d.minutes));
              return (
                <button
                  key={iso ?? `x${i}`}
                  type="button"
                  disabled={!iso}
                  onClick={() => iso && setDay(iso)}
                  className={cn(
                    "flex min-h-20 flex-col items-center gap-1 border-r border-b p-1.5 text-sm transition-colors last:border-r-0 nth-[7n]:border-r-0",
                    !iso && "bg-muted/30",
                    iso && "hover:bg-primary/5",
                    i % 7 === 0 && iso && "bg-muted/20",
                  )}
                >
                  {iso && (
                    <>
                      <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", iso === today && "bg-primary text-primary-foreground", !busy && iso !== today && "text-muted-foreground")}>{Number(iso.slice(8))}</span>
                      <DayChips d={d} />
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Phones: only days with something on them */}
        <section className="overflow-hidden rounded-xl border bg-card sm:hidden">
          {data.days.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing due and no time logged this month.</p>
          ) : (
            <ul className="divide-y">
              {data.days.map((d) => (
                <li key={d.date}>
                  <button type="button" onClick={() => setDay(d.date)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    <span className={cn("flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border text-xs leading-none", d.date === today && "border-primary bg-primary/10 text-primary")}>
                      <b className="text-sm">{Number(d.date.slice(8))}</b>
                      {WEEK[new Date(`${d.date}T00:00:00Z`).getUTCDay()]!.slice(0, 3)}
                    </span>
                    <span className="flex-1 text-sm">
                      {d.due.length > 0 && `${d.due.length} due`}
                      {d.due.length > 0 && d.minutes > 0 && " · "}
                      {d.minutes > 0 && `${mins(d.minutes)} logged`}
                    </span>
                    {d.due.some((t) => t.delayed) && <AlertTriangle className="size-4 text-destructive" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Project-wise summary */}
        <section className="h-fit overflow-hidden rounded-xl border bg-card">
          <FormHeading title={`Project summary · ${data.employee.name}`} />
          {data.projects.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No tickets for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="border-collapse text-xs [&_td]:border [&_th]:border">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Project</TableHead>
                    <TableHead className="text-center">Open</TableHead>
                    <TableHead className="text-center">Working</TableHead>
                    <TableHead className="text-center">Hold</TableHead>
                    <TableHead className="text-center">Review</TableHead>
                    <TableHead className="text-center">Delayed</TableHead>
                    <TableHead className="text-center">Done</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.projects.map((p) => {
                    const cell = (n: number, view?: string, tone?: string) => (
                      <TableCell className="text-center tabular-nums">
                        {n ? (
                          <Link href={listLink(p.project_id, view)} className={cn("font-semibold hover:underline", tone)}>
                            {n}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    );
                    return (
                      <TableRow key={String(p.project_id)}>
                        <TableCell className="max-w-48 truncate font-medium">{p.project_name}</TableCell>
                        {cell(p.open, "open")}
                        {cell(p.active, "open")}
                        {cell(p.hold, "open")}
                        {cell(p.review, "open")}
                        {cell(p.delayed, "delayed", "text-destructive")}
                        {cell(p.done, "finished", "text-success")}
                        {cell(p.total)}
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total</TableCell>
                    {(["open", "active", "hold", "review", "delayed", "done", "total"] as const).map((k) => (
                      <TableCell key={k} className="text-center tabular-nums">
                        {data.projects.reduce((s, p) => s + p[k], 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>

      {/* A day's tickets */}
      <Dialog open={Boolean(day)} onOpenChange={(o) => !o && setDay(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{day ? `${WEEK[new Date(`${day}T00:00:00Z`).getUTCDay()]}, ${fmtDate(day)}` : ""}</DialogTitle>
            <DialogDescription>
              {data.employee.name}
              {picked?.minutes ? ` · ${mins(picked.minutes)} logged` : ""}
            </DialogDescription>
          </DialogHeader>
          {!picked ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nothing due and no time logged on this day.</p>
          ) : (
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
              {picked.due.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Due this day ({picked.due.length})</h4>
                  {picked.due.map((t) => (
                    <TicketLine key={t.id} t={t} onOpen={() => open(t.id)} />
                  ))}
                </div>
              )}
              {picked.worked.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Worked on ({picked.worked.length})</h4>
                  {picked.worked.map((t) => (
                    <TicketLine key={t.id} t={t} onOpen={() => open(t.id)} extra={<span className="text-xs font-semibold text-success tabular-nums">{mins(t.minutes)}</span>} />
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TicketSheet ticketId={openId} onClose={closeSheet} onChanged={refresh} />
    </div>
  );
}
