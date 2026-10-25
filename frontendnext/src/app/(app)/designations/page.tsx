import type { Metadata } from "next";
import { DesignationsView } from "@/components/designations/designations-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Designations" };

export default function Page() {
  return (
    <PageGate>
      <DesignationsView />
    </PageGate>
  );
}
