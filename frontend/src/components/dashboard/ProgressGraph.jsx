import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchMyTasks } from "../../store/slices/tasksSlice";
import { isoDate } from "../../utils/workday";

// Timeliness of each ticket. Colors were checked with the dataviz palette
// validator in this order; gray is the deliberate neutral for "not started".
// Segments have 2px gaps and the legend lists counts, so color is never the only cue.
const STATES = {
  on_time:     { label: "On time",     color: "var(--st-approved)" },
  in_progress: { label: "On track",    color: "var(--st-progress)" },
  not_started: { label: "Not started", color: "var(--st-todo)" },
  delayed:     { label: "Delayed",     color: "var(--st-overdue)" },
};
const STATE_ORDER = ["on_time", "in_progress", "not_started", "delayed"];

const isFinished = (t) => t.status === "done" || t.status === "approved";

// on_time / delayed for finished tickets (completed vs due date);
// delayed / in_progress / not_started for open ones (today vs due date).
function classify(task, today) {
  if (isFinished(task)) {
    const doneOn = task.completed_at ? isoDate(new Date(task.completed_at)) : today;
    return task.due_date && doneOn > task.due_date ? "delayed" : "on_time";
  }
  if (task.due_date && today > task.due_date) return "delayed";
  return task.status === "todo" ? "not_started" : "in_progress";
}

// Small donut: ticket share by timeliness, overall progress % in the middle.
function Donut({ counts, total, overall, hover, setHover }) {
  const size = 120, stroke = 16, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const gap = total > 1 ? 2 : 0; // 2px surface gap between segments
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Overall progress ${overall}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "var(--chart-track)" }} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total > 0 && STATE_ORDER.filter((s) => counts[s] > 0).map((s) => {
          const len = (counts[s] / total) * c;
          const seg = (
            <circle
              key={s}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              strokeWidth={hover === s ? stroke + 3 : stroke}
              strokeDasharray={`${Math.max(len - gap, 0.1)} ${c}`}
              strokeDashoffset={-offset}
              opacity={hover && hover !== s ? 0.4 : 1}
              onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)}
              style={{ stroke: STATES[s].color, transition: "opacity 0.15s" }}
            />
          );
          offset += len;
          return seg;
        })}
      </g>
      <text x="50%" y="50%" textAnchor="middle" fontSize="22" fontFamily="Georgia, serif" style={{ fill: "rgb(var(--color-ink))" }}>
        {hover ? counts[hover] : `${overall}%`}
      </text>
      <text x="50%" y="64%" textAnchor="middle" fontSize="10" style={{ fill: "rgb(var(--color-slate))" }}>
        {hover ? STATES[hover].label.toLowerCase() : "progress"}
      </text>
    </svg>
  );
}

export default function ProgressGraph() {
  const dispatch = useDispatch();
  const tasks = useSelector((state) => state.tasks.mine);
  const [hover, setHover] = useState(null);

  useEffect(() => { dispatch(fetchMyTasks()); }, [dispatch]);

  const today = isoDate(new Date());
  const states = tasks.map((t) => classify(t, today));
  const counts = STATE_ORDER.reduce((acc, s) => ({ ...acc, [s]: states.filter((x) => x === s).length }), {});
  const total = tasks.length;
  const overall = total ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / total) : 0;
  const finished = tasks.filter(isFinished).length;

  return (
    <section className="bg-card border border-line rounded-xl p-4 w-full max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-ink">My progress</span>
        <Link to="/tickets" className="text-xs text-brass">Tickets →</Link>
      </div>
      <div className="flex items-center gap-4">
        <Donut counts={counts} total={total} overall={overall} hover={hover} setHover={setHover} />
        <div className="flex flex-col gap-1.5 min-w-0">
          {STATE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)}
              className={`flex items-center gap-1.5 text-xs text-left ${hover && hover !== s ? "opacity-50" : ""}`}
            >
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: STATES[s].color }} />
              <span className="text-slate">{STATES[s].label}</span>
              <span className="text-ink font-medium ml-auto pl-2">{counts[s]}</span>
            </button>
          ))}
          <div className="text-2xs text-slate pt-1 border-t border-line mt-0.5">
            {total ? `${finished} of ${total} tickets done` : "No tickets yet"}
          </div>
        </div>
      </div>
    </section>
  );
}
