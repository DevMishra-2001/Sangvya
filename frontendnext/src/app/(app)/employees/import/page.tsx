import type { Metadata } from "next";
import { EmployeeImportView } from "@/components/employees/employee-import-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Import employees" };

export default function Page() {
  return (
    <PageGate>
      <EmployeeImportView />
    </PageGate>
  );
}
