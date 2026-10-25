import type { Metadata } from "next";
import { BillingView } from "@/components/billing/billing-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Billing" };

export default function Page() {
  return (
    <PageGate>
      <BillingView />
    </PageGate>
  );
}
