import type { Metadata } from "next";
import { Suspense } from "react";
import { EmployeesView } from "@/components/employees/employees-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Employees" };

export default function Page() {
  return (
    <PageGate>
      {/* Reads ?page / ?search from the URL */}
      <Suspense>
        <EmployeesView />
      </Suspense>
    </PageGate>
  );
}
