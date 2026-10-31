import type { Metadata } from "next";
import { CompanySettingsView } from "@/components/company/company-settings-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Company" };

export default function Page() {
  return (
    <PageGate>
      <CompanySettingsView />
    </PageGate>
  );
}
