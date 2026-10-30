import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { RolesView } from "@/components/roles/roles-view";

export const metadata: Metadata = { title: "Roles" };

export default function Page() {
  return (
    <PageGate>
      <RolesView />
    </PageGate>
  );
}
