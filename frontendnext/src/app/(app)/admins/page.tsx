import type { Metadata } from "next";
import { AdminsView } from "@/components/admins/admins-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Admins" };

export default function Page() {
  return (
    <PageGate>
      <AdminsView />
    </PageGate>
  );
}
