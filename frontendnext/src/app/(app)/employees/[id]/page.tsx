import type { Metadata } from "next";
import { EmployeeProfileView } from "@/components/employees/employee-profile-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Employee" };

// The id is only known per request, so this page renders on request
// (the app shell reads the path, which can't be prerendered here)
export const instant = false;

export default async function Page({ params }: PageProps<"/employees/[id]">) {
  const { id } = await params;
  return (
    <PageGate>
      <EmployeeProfileView id={Number(id)} />
    </PageGate>
  );
}
