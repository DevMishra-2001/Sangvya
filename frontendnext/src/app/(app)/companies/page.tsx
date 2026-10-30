import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { CompaniesView } from "@/components/platform/companies-view";

export const metadata: Metadata = { title: "Companies" };

export default function Page() {
  return (
    <PageGate>
      <CompaniesView />
    </PageGate>
  );
}
