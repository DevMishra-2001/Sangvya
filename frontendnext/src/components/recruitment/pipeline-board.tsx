"use client";

// Candidates as cards in stage columns — drag a card to move it
import { useState } from "react";
import { CalendarClock, FileText, Star } from "lucide-react";
import { PersonAvatar } from "@/components/common/person-avatar";
import { run } from "@/lib/api/run";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { recruitmentService } from "@/lib/services/recruitment";
import type { Candidate, CandidateStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OFFER_STATUS, STAGES, lakhs } from "./labels";

export function PipelineBoard({ candidates, canMove, onOpen, onChanged }: { candidates: Candidate[]; canMove: boolean; onOpen: (id: number) => void; onChanged: () => void }) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<CandidateStage | null>(null);

  async function drop(stage: CandidateStage) {
    setOver(null);
    const c = candidates.find((x) => x.id === dragId);
    setDragId(null);
    if (!c || c.stage === stage) return;
    // Rejecting needs a reason and hiring creates an employee: both happen in the candidate panel
    if (stage === "rejected" || stage === "hired") {
      onOpen(c.id);
      return;
    }
    if ((await run(() => recruitmentService.setStage(c.id, stage), { success: `${c.name} → ${STAGES.find((s) => s.key === stage)?.label}` })).ok) onChanged();
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((s) => {
        const list = candidates.filter((c) => c.stage === s.key);
        return (
          <section
            key={s.key}
            onDragOver={(e) => {
              if (!canMove || dragId == null) return;
              e.preventDefault();
              setOver(s.key);
            }}
            onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
            onDrop={() => drop(s.key)}
            className={cn("flex w-64 shrink-0 flex-col rounded-xl border bg-muted/30", over === s.key && "border-primary bg-primary/5")}
            aria-label={`${s.label} — ${list.length}`}
          >
            <header className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
              <span className={cn("size-2 rounded-full", s.dot)} />
              {s.label}
              <span className="ml-auto rounded-full bg-background px-2 text-xs text-muted-foreground tabular-nums">{list.length}</span>
            </header>
            <div className="flex max-h-[62dvh] min-h-24 flex-col gap-2 overflow-y-auto p-2">
              {list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  draggable={canMove}
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpen(c.id)}
                  className={cn("flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left text-sm shadow-xs transition-shadow hover:border-primary/50 hover:shadow-sm", dragId === c.id && "opacity-50")}
                >
                  <span className="flex items-center gap-2">
                    <PersonAvatar name={c.name} className="size-7 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.job_title}</span>
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    {c.experience_years && <span>{Number(c.experience_years)} yrs</span>}
                    {c.expected_ctc && <span>exp. {lakhs(c.expected_ctc)}</span>}
                    {c.notice_days != null && <span>{c.notice_days}d notice</span>}
                    {c.resume_name && <FileText className="size-3" aria-label="Resume attached" />}
                  </span>
                  {(c.next_interview || c.avg_score || c.offer_status) && (
                    <span className="flex flex-wrap items-center gap-2 text-[11px]">
                      {c.next_interview && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <CalendarClock className="size-3" /> {fmtDateTime(c.next_interview)}
                        </span>
                      )}
                      {c.avg_score && (
                        <span className="flex items-center gap-0.5">
                          <Star className="size-3 fill-amber-400 text-amber-400" /> {c.avg_score}
                        </span>
                      )}
                      {c.offer_status && <span className="text-violet-600 dark:text-violet-400">Offer {OFFER_STATUS[c.offer_status].label.toLowerCase()}</span>}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">in stage {timeAgo(c.stage_changed_at).replace(" ago", "")}</span>
                </button>
              ))}
              {!list.length && <p className="p-2 text-center text-xs text-muted-foreground">{canMove ? "Drop here" : "Nobody"}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
