import { Suspense } from "react";
import type { Metadata } from "next";
import { ViewExpenseView } from "@/components/expenses/view-expense-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "View Expense" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <ViewExpenseView />
      </Suspense>
    </PageGate>
  );
}
