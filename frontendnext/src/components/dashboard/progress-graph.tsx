"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDate } from "@/lib/format";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTasksStore } from "@/stores/tasks-store";

// Timeliness of each ticket; always shown with labels + counts
const STATES = {
  on_time: { label: "On time", color: "var(--status-approved)" },
  in_progress: { label: "On track", color: "var(--status-progress)" },
  not_started: { label: "Not started", color: "var(--status-todo)" },
  delayed: { label: "Delayed", color: "var(--status-overdue)" },
} as const;
type Timeliness = keyof typeof STATES;
const ORDER: Timeliness[] = ["on_time", "in_progress", "not_started", "delayed"];

const isFinished = (t: Task) => t.status === "done" || t.status === "approved";

function classify(task: Task, today: string): Timeliness {
  if (isFinished(task)) {
    const doneOn = task.completed_at ? isoDate(new Date(task.completed_at)) : today;
    return task.due_date && doneOn > task.due_date ? "delayed" : "on_time";
  }
  if (task.due_date && today > task.due_date) return "delayed";
  return task.status === "todo" ? "not_started" : "in_progress";
}

function Donut({ counts, total, overall, hover, setHover }: { counts: Record<Timeliness, number>; total: number; overall: number; hover: Timeliness | null; setHover: (s: Timeliness | null) => void }) {
  const size = 120, stroke = 16, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const gap = total > 1 ? 2 : 0;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Overall progress ${overall}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "var(--muted)" }} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total > 0 &&
          ORDER.filter((s) => counts[s] > 0).map((s) => {
            const len = (counts[s] / total) * c;
            const seg = (
              <circle
                key={s}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={hover === s ? stroke + 3 : stroke}
                strokeDasharray={`${Math.max(len - gap, 0.1)} ${c}`}
                strokeDashoffset={-offset}
                opacity={hover && hover !== s ? 0.4 : 1}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                style={{ stroke: STATES[s].color, transition: "opacity 0.15s" }}
              />
            );
            offset += len;
            return seg;
          })}
      </g>
      <text x="50%" y="50%" textAnchor="middle" fontSize="22" fontWeight="600" style={{ fill: "var(--foreground)" }}>
        {hover ? counts[hover] : `${overall}%`}
      </text>
      <text x="50%" y="64%" textAnchor="middle" fontSize="10" style={{ fill: "var(--muted-foreground)" }}>
        {hover ? STATES[hover].label.toLowerCase() : "progress"}
      </text>
    </svg>
  );
}

// Small donut of my tickets by timeliness, overall progress in the middle
export function ProgressGraph() {
  const tasks = useTasksStore((s) => s.mine);
  const loadMine = useTasksStore((s) => s.loadMine);
  const [hover, setHover] = useState<Timeliness | null>(null);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const today = isoDate(new Date());
  const states = tasks.map((t) => classify(t, today));
  const counts = Object.fromEntries(ORDER.map((s) => [s, states.filter((x) => x === s).length])) as Record<Timeliness, number>;
  const total = tasks.length;
  const overall = total ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / total) : 0;
  const finished = tasks.filter(isFinished).length;

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-sm">My progress</CardTitle>
        <CardAction>
          <Link href="/tickets" className="text-xs text-primary hover:underline">
            Tickets →
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Donut counts={counts} total={total} overall={overall} hover={hover} setHover={setHover} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s)}
              onBlur={() => setHover(null)}
              className={cn("flex items-center gap-1.5 text-left text-xs", hover && hover !== s && "opacity-50")}
            >
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: STATES[s].color }} />
              <span className="whitespace-nowrap text-muted-foreground">{STATES[s].label}</span>
              <span className="ml-auto pl-2 font-medium">{counts[s]}</span>
            </button>
          ))}
          <div className="mt-0.5 border-t pt-1 text-2xs text-muted-foreground">{total ? `${finished} of ${total} tickets done` : "No tickets yet"}</div>
        </div>
      </CardContent>
    </Card>
  );
}
