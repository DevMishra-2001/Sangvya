import type { Metadata } from "next";
import { CustomRolesView } from "@/components/custom-roles/custom-roles-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Custom Roles" };

export default function Page() {
  return (
    <PageGate>
      <CustomRolesView />
    </PageGate>
  );
}
