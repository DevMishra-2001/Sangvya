import type { Metadata } from "next";
import { TicketsView } from "@/components/tasks/tickets-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Tickets" };

export default function Page() {
  return (
    <PageGate>
      <TicketsView />
    </PageGate>
  );
}
