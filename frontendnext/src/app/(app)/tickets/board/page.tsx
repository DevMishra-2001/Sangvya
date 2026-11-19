import { Suspense } from "react";
import type { Metadata } from "next";
import { BoardView } from "@/components/tickets/board-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Task Tracker" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <BoardView />
      </Suspense>
    </PageGate>
  );
}
