import { Suspense } from "react";
import type { Metadata } from "next";
import { ExpenseSubmissionView } from "@/components/expenses/expense-submission-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Expense Submission" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <ExpenseSubmissionView />
      </Suspense>
    </PageGate>
  );
}
