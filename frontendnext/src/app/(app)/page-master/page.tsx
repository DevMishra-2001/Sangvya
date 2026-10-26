import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { PageMasterView } from "@/components/pages/page-master-view";

export const metadata: Metadata = { title: "Page Master" };

export default function Page() {
  return (
    <PageGate>
      <PageMasterView />
    </PageGate>
  );
}
