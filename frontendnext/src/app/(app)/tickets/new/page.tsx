import { Suspense } from "react";
import type { Metadata } from "next";
import { NewTicketView } from "@/components/tickets/new-ticket-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "New Ticket" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <NewTicketView />
      </Suspense>
    </PageGate>
  );
}
