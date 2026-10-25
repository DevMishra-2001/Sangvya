"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_META, STATUS_ORDER, type TicketStatus } from "@/lib/constants";
import type { TaskStats } from "@/lib/types";

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="min-w-32 flex-1 gap-1 py-3">
      <CardContent>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-2xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// Part-to-whole: one stacked bar + a labelled legend with counts
function StatusBar({ counts, total }: { counts: TaskStats["counts"]; total: number }) {
  const [hover, setHover] = useState<TicketStatus | null>(null);
  const parts = STATUS_ORDER.filter((s) => counts[s] > 0);
  return (
    <div>
      {total === 0 ? (
        <div className="h-3 rounded-full bg-muted" />
      ) : (
        <div className="relative">
          <div className="flex h-3 gap-[2px]">
            {parts.map((s) => (
              <div
                key={s}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS_META[s].color, opacity: hover && hover !== s ? 0.45 : 1 }}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </div>
          {hover && (
            <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background">
              {STATUS_META[hover].label}: {counts[hover]} ({Math.round((counts[hover] / total) * 100)}%)
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {STATUS_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: STATUS_META[s].color }} />
            {STATUS_META[s].label} <span className="font-medium text-foreground">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tickets completed per week (last 8 weeks) — one series, so the title names it
function WeeklyChart({ weekly }: { weekly: TaskStats["weekly"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 420, H = 150, padL = 26, padB = 22, padT = 8;
  const max = Math.max(2, ...weekly.map((w) => w.completed));
  const ticks = [0, Math.ceil(max / 2), max];
  const plotW = W - padL, plotH = H - padB - padT;
  const slot = plotW / weekly.length;
  const barW = Math.min(28, slot - 8);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tickets completed per week, last 8 weeks">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} strokeWidth="1" style={{ stroke: "var(--border)" }} strokeDasharray={t === 0 ? "" : "2 3"} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" style={{ fill: "var(--muted-foreground)" }}>
              {t}
            </text>
          </g>
        ))}
        {weekly.map((w, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(w.completed));
          return (
            <g key={w.week} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" />
              {w.completed > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(0) - h + 4} Q${x},${y(0) - h} ${x + 4},${y(0) - h} H${x + barW - 4} Q${x + barW},${y(0) - h} ${x + barW},${y(0) - h + 4} V${y(0)} Z`}
                  style={{ fill: "var(--primary)" }}
                  opacity={hover !== null && hover !== i ? 0.5 : 1}
                />
              )}
              {(i % 2 === 1 || i === weekly.length - 1) && (
                <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" style={{ fill: "var(--muted-foreground)" }}>
                  {label(w.week)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background"
          style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}
        >
          Week of {label(weekly[hover].week)}: {weekly[hover].completed} completed
        </div>
      )}
    </div>
  );
}

export function TaskCharts({ stats }: { stats: TaskStats | null }) {
  if (!stats) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Tile label="Total tickets" value={stats.total} />
        <Tile label="Completed" value={`${stats.completionRate}%`} hint="done + approved" />
        <Tile label="On time" value={`${stats.onTimeRate}%`} hint="of completed tickets" />
        <Tile label="Avg progress" value={`${stats.avgProgress}%`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tickets by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBar counts={stats.counts} total={stats.total} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tickets completed per week</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyChart weekly={stats.weekly} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
