import { useState } from "react";
import { CheckCircle2, RotateCcw, Trash2, CalendarPlus, CalendarClock, UserRound, BadgeCheck } from "lucide-react";
import { STATUS_META, PRIORITY_META, displayStatus, fmtDate } from "../../utils/tasks";

function StatusPill({ task }) {
  const meta = STATUS_META[displayStatus(task)];
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-medium px-2 py-0.5 rounded-full text-ink" style={{ background: meta.bg }}>
      <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

function Meta({ icon: Icon, label, value, warn }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate">
      <Icon size={13} />
      <span>{label}:</span>
      <span className={warn ? "text-rust font-medium" : "text-ink"}>{value}</span>
    </div>
  );
}

// One task. mode="mine": the assignee updates status/progress.
// mode="assigned": the assigner sees who it's for and can approve/reopen/delete.
export default function TaskCard({ task, mode, onProgress, onReview, onDelete }) {
  const [progress, setProgress] = useState(task.progress);
  const status = displayStatus(task);
  const meta = STATUS_META[status];
  const locked = task.status === "approved";

  return (
    <div className="bg-card border border-line rounded-lg p-4 flex flex-col gap-2.5 border-l-4" style={{ borderLeftColor: meta.color }}>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{task.title}</div>
          {task.description && <div className="text-xs text-slate mt-0.5 whitespace-pre-line">{task.description}</div>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-2xs px-2 py-0.5 rounded-full ${PRIORITY_META[task.priority]?.className}`}>
            {PRIORITY_META[task.priority]?.label}
          </span>
          <StatusPill task={task} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {mode === "assigned"
          ? <Meta icon={UserRound} label="Assigned to" value={task.assigned_to_name} />
          : <Meta icon={UserRound} label="Assigned by" value={task.assigned_by_name || "—"} />}
        <Meta icon={CalendarPlus} label="Assigned on" value={fmtDate(task.assigned_date)} />
        <Meta icon={CalendarClock} label="Due" value={fmtDate(task.due_date)} warn={task.overdue} />
        <Meta
          icon={BadgeCheck}
          label="Approved by"
          value={task.approved_by_name ? `${task.approved_by_name} · ${fmtDate(task.approved_at)}` : task.status === "done" ? "Waiting for approval" : "—"}
        />
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-ivory rounded-full overflow-hidden" role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full transition-all" style={{ width: `${task.progress}%`, background: meta.color }} />
        </div>
        <span className="text-xs text-ink w-9 text-right">{task.progress}%</span>
      </div>

      {mode === "mine" && !locked && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
          <select
            value={task.status}
            onChange={(e) => onProgress({ id: task.id, status: e.target.value, progress })}
            className="text-xs border border-line rounded-md px-2 py-1.5 mt-2"
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          {task.status === "in_progress" && (
            <div className="flex items-center gap-2 mt-2 flex-1 min-w-[180px]">
              <input
                type="range" min={1} max={99} value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                onMouseUp={() => onProgress({ id: task.id, status: "in_progress", progress })}
                onTouchEnd={() => onProgress({ id: task.id, status: "in_progress", progress })}
                onKeyUp={() => onProgress({ id: task.id, status: "in_progress", progress })}
                className="flex-1 accent-brass"
                aria-label="Progress"
              />
              <span className="text-xs w-8">{progress}%</span>
            </div>
          )}
        </div>
      )}

      {mode === "assigned" && (
        <div className="flex gap-2 pt-2 border-t border-line">
          {task.status === "done" && (
            <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-leaf text-leaf" onClick={() => onReview({ id: task.id, action: "approve" })}>
              <CheckCircle2 size={13} /> Approve
            </button>
          )}
          {["done", "approved"].includes(task.status) && (
            <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-line text-slate" onClick={() => onReview({ id: task.id, action: "reopen" })}>
              <RotateCcw size={13} /> Reopen
            </button>
          )}
          <button className="ml-auto p-1 text-slate hover:text-rust" onClick={() => onDelete(task.id)} aria-label="Delete task">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
