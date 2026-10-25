import type { Metadata } from "next";
import { PayrollView } from "@/components/payroll/payroll-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Payroll" };

export default function Page() {
  return (
    <PageGate>
      <PayrollView />
    </PageGate>
  );
}
