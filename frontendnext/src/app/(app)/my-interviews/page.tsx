import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { MyInterviewsView } from "@/components/recruitment/my-interviews-view";

export const metadata: Metadata = { title: "My interviews" };

export default function Page() {
  return (
    <PageGate>
      <MyInterviewsView />
    </PageGate>
  );
}
