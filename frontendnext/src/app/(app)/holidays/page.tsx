import type { Metadata } from "next";
import { HolidaysView } from "@/components/holidays/holidays-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Holidays" };

export default function Page() {
  return (
    <PageGate>
      <HolidaysView />
    </PageGate>
  );
}
