import type { Metadata } from "next";
import { ChangePasswordView } from "@/components/settings/change-password-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Change Password" };

export default function Page() {
  return (
    <PageGate>
      <ChangePasswordView />
    </PageGate>
  );
}
