"use client";

import { useState } from "react";
import { BadgeCheck, CalendarClock, CalendarPlus, CheckCircle2, RotateCcw, UserRound } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { PRIORITY_META, STATUS_META, displayStatus } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SelectField } from "@/components/common/select-field";

function Meta({ icon: Icon, label, value, warn }: { icon: typeof UserRound; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span>{label}:</span>
      <span className={cn("truncate", warn ? "font-medium text-destructive" : "text-foreground")}>{value}</span>
    </div>
  );
}

// One ticket. mode="mine": the assignee moves it along.
// mode="assigned": the assigner sees who it's for and can approve / reopen / delete.
export function TaskCard({
  task,
  mode,
  onProgress,
  onReview,
  onDelete,
}: {
  task: Task;
  mode: "mine" | "assigned";
  onProgress?: (status: TaskStatus, progress: number) => void;
  onReview?: (action: "approve" | "reopen") => void;
  onDelete?: () => void;
}) {
  const [progress, setProgress] = useState(task.progress);
  const status = displayStatus(task);
  const meta = STATUS_META[status];
  const locked = task.status === "approved";

  return (
    <Card className="gap-3 border-l-4 py-4" style={{ borderLeftColor: meta.color }}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{task.title}</div>
            {task.description && <p className="mt-0.5 text-xs whitespace-pre-line text-muted-foreground">{task.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-2xs font-medium", PRIORITY_META[task.priority].className)}>{PRIORITY_META[task.priority].label}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium">
              <span className="size-2 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {mode === "assigned" ? <Meta icon={UserRound} label="Assigned to" value={task.assigned_to_name} /> : <Meta icon={UserRound} label="Assigned by" value={task.assigned_by_name || "—"} />}
          <Meta icon={CalendarPlus} label="Assigned on" value={fmtDate(task.assigned_date)} />
          <Meta icon={CalendarClock} label="Due" value={fmtDate(task.due_date)} warn={task.overdue} />
          <Meta
            icon={BadgeCheck}
            label="Approved by"
            value={task.approved_by_name ? `${task.approved_by_name} · ${fmtDate(task.approved_at)}` : task.status === "done" ? "Waiting for approval" : "—"}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className="h-full rounded-full transition-all" style={{ width: `${task.progress}%`, background: meta.color }} />
          </div>
          <span className="w-9 text-right text-xs tabular-nums">{task.progress}%</span>
        </div>

        {mode === "mine" && !locked && onProgress && (
          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <SelectField
              size="sm"
              className="w-auto"
              value={task.status}
              onValueChange={(v) => onProgress(v as TaskStatus, progress)}
              aria-label="Status"
              options={[
                { value: "todo", label: "To do" },
                { value: "in_progress", label: "In progress" },
                { value: "done", label: "Done" },
              ]}
            />
            {task.status === "in_progress" && (
              <div className="flex min-w-44 flex-1 items-center gap-2">
                <Slider min={1} max={99} step={1} value={[progress]} onValueChange={([v]) => setProgress(v)} onValueCommit={([v]) => onProgress("in_progress", v)} aria-label="Progress" />
                <span className="w-9 text-xs tabular-nums">{progress}%</span>
              </div>
            )}
          </div>
        )}

        {mode === "assigned" && (
          <div className="flex items-center gap-2 border-t pt-3">
            {task.status === "done" && (
              <Button variant="outline" size="sm" className="border-success/40 text-success hover:bg-success/10" onClick={() => onReview?.("approve")}>
                <CheckCircle2 /> Approve
              </Button>
            )}
            {(task.status === "done" || task.status === "approved") && (
              <Button variant="outline" size="sm" onClick={() => onReview?.("reopen")}>
                <RotateCcw /> Reopen
              </Button>
            )}
            <div className="ml-auto">{onDelete && <ConfirmDelete title={`Delete “${task.title}”?`} onConfirm={onDelete} />}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
