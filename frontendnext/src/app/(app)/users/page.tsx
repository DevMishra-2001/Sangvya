import type { Metadata } from "next";
import { UsersView } from "@/components/users/users-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Users & Roles" };

export default function Page() {
  return (
    <PageGate>
      <UsersView />
    </PageGate>
  );
}
