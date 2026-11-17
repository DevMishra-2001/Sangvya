import { Suspense } from "react";
import type { Metadata } from "next";
import { TicketSettingsView } from "@/components/tickets/ticket-settings-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Ticket Settings" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <TicketSettingsView />
      </Suspense>
    </PageGate>
  );
}
