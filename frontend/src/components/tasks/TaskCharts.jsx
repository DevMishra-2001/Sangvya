import { useState } from "react";
import { STATUS_ORDER, STATUS_META } from "../../utils/tasks";

function Tile({ label, value, hint }) {
  return (
    <div className="bg-card border border-line rounded-lg px-4 py-3 flex-1 min-w-[130px]">
      <div className="text-xs text-slate mb-1">{label}</div>
      <div className="font-serif text-2xl text-ink">{value}</div>
      {hint && <div className="text-2xs text-slate mt-0.5">{hint}</div>}
    </div>
  );
}

// Part-to-whole of the employee's tasks: one stacked bar + a labelled legend
// with counts (identity never rests on color alone).
function StatusBar({ counts, total }) {
  const [hover, setHover] = useState(null);
  const parts = STATUS_ORDER.filter((s) => counts[s] > 0);

  return (
    <div>
      <div className="text-sm font-medium text-ink mb-2">Tasks by status</div>
      {total === 0 ? (
        <div className="h-3 rounded-full bg-ivory" />
      ) : (
        <div className="relative">
          <div className="flex h-3 gap-[2px]">
            {parts.map((s) => (
              <div
                key={s}
                className="h-full first:rounded-l-full last:rounded-r-full cursor-default"
                style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS_META[s].color, opacity: hover && hover !== s ? 0.45 : 1 }}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </div>
          {hover && (
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-ink text-ivory text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none">
              {STATUS_META[hover].label}: {counts[hover]} ({Math.round((counts[hover] / total) * 100)}%)
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {STATUS_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-slate">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_META[s].color }} />
            {STATUS_META[s].label} <span className="text-ink font-medium">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tasks completed per week (last 8 weeks). Single series -> the title names it, no legend.
function WeeklyChart({ weekly }) {
  const [hover, setHover] = useState(null);
  const W = 420, H = 150, padL = 26, padB = 22, padT = 8;
  const max = Math.max(2, ...weekly.map((w) => w.completed));
  const ticks = [0, Math.ceil(max / 2), max];
  const plotW = W - padL, plotH = H - padB - padT;
  const slot = plotW / weekly.length;
  const barW = Math.min(28, slot - 8);
  const y = (v) => padT + plotH - (v / max) * plotH;
  const label = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div>
      <div className="text-sm font-medium text-ink mb-2">Tasks completed per week</div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Tasks completed per week, last 8 weeks">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W} y1={y(t)} y2={y(t)} strokeWidth="1" style={{ stroke: "rgb(var(--color-line))" }} strokeDasharray={t === 0 ? "" : "2 3"} />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" style={{ fill: "rgb(var(--color-slate))" }}>{t}</text>
            </g>
          ))}
          {weekly.map((w, i) => {
            const x = padL + i * slot + (slot - barW) / 2;
            const h = Math.max(0, y(0) - y(w.completed));
            return (
              <g key={w.week} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* Hit target larger than the mark */}
                <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" />
                {w.completed > 0 && (
                  <path
                    d={`M${x},${y(0)} V${y(0) - h + 4} Q${x},${y(0) - h} ${x + 4},${y(0) - h} H${x + barW - 4} Q${x + barW},${y(0) - h} ${x + barW},${y(0) - h + 4} V${y(0)} Z`}
                    style={{ fill: "var(--st-done)" }}
                    opacity={hover !== null && hover !== i ? 0.5 : 1}
                  />
                )}
                {(i % 2 === 1 || i === weekly.length - 1) && (
                  <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" style={{ fill: "rgb(var(--color-slate))" }}>{label(w.week)}</text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="absolute top-0 bg-ink text-ivory text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none -translate-x-1/2"
            style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}
          >
            Week of {label(weekly[hover].week)}: {weekly[hover].completed} completed
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskCharts({ stats }) {
  if (!stats) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Tile label="Total tasks" value={stats.total} />
        <Tile label="Completed" value={`${stats.completionRate}%`} hint="done + approved" />
        <Tile label="On time" value={`${stats.onTimeRate}%`} hint="of completed tasks" />
        <Tile label="Avg progress" value={`${stats.avgProgress}%`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-line rounded-lg p-4"><StatusBar counts={stats.counts} total={stats.total} /></div>
        <div className="bg-card border border-line rounded-lg p-4"><WeeklyChart weekly={stats.weekly} /></div>
      </div>
    </div>
  );
}
