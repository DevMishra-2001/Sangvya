import { Badge } from "@/components/ui/badge";
import type { CompanyStatus, VerificationStatus } from "@/lib/types";

const VERIFY: Record<VerificationStatus, { label: string; className: string }> = {
  unverified: { label: "Unverified", className: "bg-muted text-muted-foreground" },
  pending: { label: "In review", className: "bg-warning/15 text-warning" },
  verified: { label: "Verified", className: "bg-success/15 text-success" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const v = VERIFY[status] ?? VERIFY.unverified;
  return <Badge className={v.className}>{v.label}</Badge>;
}

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  return status === "suspended" ? <Badge variant="destructive">Suspended</Badge> : <Badge className="bg-success/15 text-success">Active</Badge>;
}

export const VERIFICATION_OPTIONS = (Object.keys(VERIFY) as VerificationStatus[]).map((v) => ({ value: v, label: VERIFY[v].label }));
