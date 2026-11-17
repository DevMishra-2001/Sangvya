import { Suspense } from "react";
import type { Metadata } from "next";
import { ViewTicketsView } from "@/components/tickets/view-tickets-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "View Tickets" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <ViewTicketsView />
      </Suspense>
    </PageGate>
  );
}
