"use client";

// Everyone: my reviews (goals, self review, result) — and for managers, the team's reviews
import { useCallback, useEffect, useState } from "react";
import { Star, Users } from "lucide-react";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PersonAvatar } from "@/components/common/person-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate } from "@/lib/format";
import { performanceService } from "@/lib/services/performance";
import type { ReviewRow } from "@/lib/types";
import { useUser } from "@/stores/auth-store";
import { REVIEW_STATUS, RATING_LABELS } from "./labels";
import { ReviewPanel } from "./review-panel";

function ReviewCard({ r, onOpen, showPerson }: { r: ReviewRow; onOpen: () => void; showPerson?: boolean }) {
  const due = r.status === "pending_self" ? r.self_due : r.status === "pending_manager" ? r.manager_due : null;
  return (
    <button type="button" onClick={onOpen} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50">
      {showPerson && <PersonAvatar name={r.employee_name} photoUrl={r.photo_url} className="size-10" />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{showPerson ? r.employee_name : r.cycle_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {showPerson ? r.cycle_name : r.manager_name ? `Reviewer: ${r.manager_name}` : "Reviewed by HR"} · {r.goal_count} goal{r.goal_count === 1 ? "" : "s"}
          {due && ` · due ${fmtDate(due)}`}
        </p>
      </div>
      {r.final_rating && !showPerson && (
        <span className="text-right text-sm">
          <span className="block text-lg font-semibold tabular-nums">{r.final_rating}/5</span>
          <span className="text-xs text-muted-foreground">{RATING_LABELS[r.final_rating]}</span>
        </span>
      )}
      <StatusBadge tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</StatusBadge>
    </button>
  );
}

export function MyPerformanceView() {
  const user = useUser();
  const url = useUrlParams();
  const [data, setData] = useState<{ mine: ReviewRow[]; team: ReviewRow[] } | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!user.employee_id) return;
    let cancelled = false;
    run(() => performanceService.me()).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, [user.employee_id, version]);

  if (!user.employee_id) return <NotLinkedState />;
  const waiting = data?.team.filter((r) => r.status === "pending_manager").length ?? 0;
  const tab = url.get("tab", "mine");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="My performance" description="Your goals and reviews. Managers also review their team here." className="mb-0" />
      {!data ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <Tabs value={data.team.length ? tab : "mine"} onValueChange={(v) => url.set({ tab: v === "mine" ? null : v })}>
          {data.team.length > 0 && (
            <TabsList>
              <TabsTrigger value="mine">My reviews</TabsTrigger>
              <TabsTrigger value="team">My team{waiting ? ` (${waiting} to review)` : ""}</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="mine" className="mt-4 flex flex-col gap-2">
            {data.mine.length ? data.mine.map((r) => <ReviewCard key={r.id} r={r} onOpen={() => setOpenId(r.id)} />) : <EmptyState icon={Star} title="No reviews yet" description="When HR starts a review cycle, it shows up here." />}
          </TabsContent>
          <TabsContent value="team" className="mt-4 flex flex-col gap-2">
            {data.team.length ? data.team.map((r) => <ReviewCard key={r.id} r={r} showPerson onOpen={() => setOpenId(r.id)} />) : <EmptyState icon={Users} title="Nobody to review" />}
          </TabsContent>
        </Tabs>
      )}
      <ReviewPanel reviewId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
    </div>
  );
}
