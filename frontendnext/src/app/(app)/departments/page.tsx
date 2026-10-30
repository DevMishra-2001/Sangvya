import type { Metadata } from "next";
import { DepartmentsView } from "@/components/departments/departments-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Departments" };

export default function Page() {
  return (
    <PageGate>
      <DepartmentsView />
    </PageGate>
  );
}
