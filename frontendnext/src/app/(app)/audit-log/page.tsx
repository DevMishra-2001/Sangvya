import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { AuditLogView } from "@/components/audit/audit-log-view";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return (
    <PageGate>
      <AuditLogView />
    </PageGate>
  );
}
