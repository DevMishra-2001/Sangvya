"use client";

import { useState } from "react";
import { NotLinkedState } from "@/components/common/empty-state";
import { MonthPicker } from "@/components/common/month-picker";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BALANCE_TYPES, SHORT_LEAVE_LABELS } from "@/lib/constants";
import { hhmm, isoDate, toMonth } from "@/lib/format";
import type { Leave } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUser } from "@/stores/auth-store";
import { DayDialog, type DayInfo } from "./day-dialog";
import { useCalendar, type CalendarEntry } from "./use-calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Day kinds → colors. Always paired with a text label in the cell and the legend.
const LOOKS = {
  pending: { label: "Pending approval", color: "var(--warning)" },
  approved: { label: "Approved leave", color: "var(--success)" },
  holiday: { label: "Holiday", color: "var(--info)" },
  optionalHoliday: { label: "Optional holiday", color: "var(--muted-foreground)" },
  optional: { label: "Optional leave", color: "oklch(0.606 0.25 292.717)" },
  missing: { label: "Missing attendance", color: "var(--destructive)" },
  working: { label: "Working day", color: "var(--primary)" },
} as const;
type Look = keyof typeof LOOKS;

function dayLook(date: string, today: string, weeklyOff: boolean, { day, holiday, leaves }: CalendarEntry): { look?: Look; text?: string } {
  const leave = leaves.find((l: Leave) => l.status === "pending" || l.status === "approved");
  if (day?.punchIn) return { look: "working" };
  if (holiday && !holiday.is_optional) return { look: "holiday", text: holiday.name };
  if (leave) {
    const text = SHORT_LEAVE_LABELS[leave.leave_type];
    if (leave.status === "pending") return { look: "pending", text };
    return { look: leave.leave_type === "ol" ? "optional" : "approved", text };
  }
  if (holiday?.is_optional) return { look: "optionalHoliday", text: holiday.name };
  if (weeklyOff || date >= today) return {};
  return { look: "missing", text: "Missing" };
}

// Calendar cells, Sunday-first, padded before day 1
function buildCells(month: string) {
  const [y, m] = month.split("-").map(Number);
  const cells: (string | null)[] = Array(new Date(y, m - 1, 1).getDay()).fill(null);
  for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) cells.push(isoDate(new Date(y, m - 1, d)));
  return cells;
}

const time12 = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// The month at a glance + leave balances. Click a day to apply for leave.
export function CalendarView() {
  const user = useUser();
  const [month, setMonth] = useState(() => toMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);
  const { calendar, byDate, reload } = useCalendar(month, Boolean(user.employee_id));

  if (!user.employee_id) return <NotLinkedState />;

  const today = calendar?.today ?? isoDate(new Date());
  const balances = calendar?.balances;
  const empty: CalendarEntry = { day: null, holiday: null, leaves: [] };
  // The company's weekly offs (Sunday until the calendar loads) and the shift's hours
  const weeklyOffs = calendar?.weeklyOffs ?? [0];
  const requiredMin = calendar?.rules.requiredMinutes ?? 9 * 60;
  const requiredEffectiveMin = requiredMin - (calendar?.rules.maxBreakMinutes ?? 60);
  const selectedInfo: DayInfo | null = selected
    ? { date: selected, ...(byDate[selected] ?? empty), isSunday: weeklyOffs.includes(new Date(`${selected}T00:00:00`).getDay()) }
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Attendance calendar" className="mb-0" actions={<MonthPicker value={month} onChange={setMonth} allowFuture />} />

      <div className="flex flex-wrap items-center gap-2" aria-label="Leave available">
        <span className="mr-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Available</span>
        {BALANCE_TYPES.map((t) => (
          <span key={t} className="rounded-full border px-3 py-1 text-xs font-semibold">
            {SHORT_LEAVE_LABELS[t]}: <span className="text-primary tabular-nums">{balances ? balances[t].available : "—"}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <Card className="min-w-0 flex-1 py-4">
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((w) => (
                <div key={w} className="rounded-md bg-muted py-1.5 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {w}
                </div>
              ))}
              {buildCells(month).map((date, i) => {
                if (!date) return <div key={`pad-${i}`} className="min-h-24 rounded-lg bg-muted/40" />;
                const info = byDate[date] ?? empty;
                const { look, text } = dayLook(date, today, weeklyOffs.includes(i % 7), info);
                const d = info.day;
                const effective = d ? d.totalMinutes - d.breakMinutes : 0;
                const running = Boolean(d?.punchIn && !d.punchOut);
                const color = look ? LOOKS[look].color : undefined;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelected(date)}
                    aria-label={`${date}${look ? `, ${LOOKS[look].label}` : ""}${text ? `, ${text}` : ""}`}
                    className={cn("flex min-h-24 flex-col gap-1 rounded-lg border p-1.5 text-left transition hover:border-primary/50", date === today && "ring-2 ring-primary")}
                    style={color ? { background: `color-mix(in oklch, ${color} 14%, transparent)`, borderColor: `color-mix(in oklch, ${color} 35%, transparent)` } : undefined}
                  >
                    <span className="text-sm font-semibold tabular-nums">{Number(date.slice(8))}</span>
                    {text && (
                      <span className="truncate text-xs font-medium" style={{ color }}>
                        {text}
                      </span>
                    )}
                    {d?.punchIn && (
                      <span className="text-2xs leading-4 text-muted-foreground">
                        <span className="text-foreground tabular-nums">
                          {time12(d.punchIn)} – {d.punchOut ? time12(d.punchOut) : "…"}
                        </span>
                        <br />
                        Work <b className={cn("tabular-nums", !running && d.totalMinutes < requiredMin ? "text-destructive" : "text-foreground")}>{hhmm(d.totalMinutes)}</b>
                        <br />
                        Effective{" "}
                        <b className={cn("tabular-nums", !running && effective < requiredEffectiveMin ? "text-destructive" : "text-foreground")}>{hhmm(Math.max(0, effective))}</b>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <aside className="flex shrink-0 flex-col gap-3 xl:w-64">
          <Card className="py-4">
            <CardContent className="flex flex-col gap-2">
              {(Object.keys(LOOKS) as Look[]).map((k) => (
                <span key={k} className="flex items-center gap-2.5 text-sm">
                  <span className="size-4 rounded" style={{ background: `color-mix(in oklch, ${LOOKS[k].color} 30%, transparent)`, border: `1px solid ${LOOKS[k].color}` }} />
                  {LOOKS[k].label}
                </span>
              ))}
            </CardContent>
          </Card>
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <b>Note:</b> unused SL carries forward to the next financial year.
          </p>
        </aside>
      </div>

      {calendar && (
        <DayDialog
          info={selectedInfo}
          rules={calendar.rules}
          balances={balances}
          onClose={() => setSelected(null)}
          onApplied={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
