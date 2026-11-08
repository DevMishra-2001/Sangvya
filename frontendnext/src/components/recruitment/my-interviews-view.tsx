"use client";

// Interviews I'm taking — open from the notification, give feedback after
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { run } from "@/lib/api/run";
import { recruitmentService } from "@/lib/services/recruitment";
import type { Interview } from "@/lib/types";
import { FeedbackDialog } from "./interview-dialogs";
import { MyInterviewsList } from "./recruitment-view";

export function MyInterviewsView() {
  const [list, setList] = useState<Interview[] | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<Interview | null>(null);

  const load = useCallback(async () => {
    const r = await run(() => recruitmentService.myInterviews());
    setList(r.ok ? r.data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    run(() => recruitmentService.myInterviews()).then((r) => !cancelled && setList(r.ok ? r.data : []));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="My interviews" description="Candidates you're interviewing. Add your feedback after each round." className="mb-0" />
      {!list ? <Skeleton className="h-40 rounded-xl" /> : <MyInterviewsList interviews={list} onFeedback={setFeedbackFor} />}
      <FeedbackDialog interview={feedbackFor} onClose={() => setFeedbackFor(null)} onDone={load} />
    </div>
  );
}
