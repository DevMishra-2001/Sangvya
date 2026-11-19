import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarView } from "@/components/tickets/calendar-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Ticket Calendar" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <CalendarView />
      </Suspense>
    </PageGate>
  );
}
