import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { MyHolidaysView } from "@/components/holidays/my-holidays-view";

export const metadata: Metadata = { title: "Holidays" };

export default function Page() {
  return (
    <PageGate>
      <MyHolidaysView />
    </PageGate>
  );
}
