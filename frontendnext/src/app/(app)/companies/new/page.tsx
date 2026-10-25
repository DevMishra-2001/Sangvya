import type { Metadata } from "next";
import { NewCompanyView } from "@/components/companies/new-company-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "New company" };

export default function Page() {
  return (
    <PageGate>
      <NewCompanyView />
    </PageGate>
  );
}
