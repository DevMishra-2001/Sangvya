import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { MyPayslipsView } from "@/components/payslips/my-payslips-view";

export const metadata: Metadata = { title: "My Payslips" };

export default function Page() {
  return (
    <PageGate>
      <MyPayslipsView />
    </PageGate>
  );
}
