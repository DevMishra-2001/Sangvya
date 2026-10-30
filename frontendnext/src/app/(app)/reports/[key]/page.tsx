import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { ReportView } from "@/components/reports/report-view";

export const metadata: Metadata = { title: "Report" };

// The key is only known per request (see employees/[id])
export const instant = false;

export default async function Page({ params }: PageProps<"/reports/[key]">) {
  const { key } = await params;
  return (
    <PageGate>
      <ReportView reportKey={key} />
    </PageGate>
  );
}
