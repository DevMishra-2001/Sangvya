import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// The groups an action belongs to (the part before the dot)
export const AUDIT_GROUPS = [
  { value: "company", label: "Companies" },
  { value: "module", label: "Modules" },
  { value: "admin", label: "Admin invites" },
  { value: "invite", label: "Activations" },
  { value: "employee", label: "Employees" },
  { value: "login", label: "Logins" },
  { value: "role", label: "Roles" },
  { value: "page", label: "Page Master" },
];

const TONES: Record<string, string> = {
  suspended: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
  removed: "bg-destructive/15 text-destructive",
  blocked: "bg-destructive/15 text-destructive",
  disabled: "bg-warning/15 text-warning",
  verified: "bg-success/15 text-success",
  reactivated: "bg-success/15 text-success",
  accepted: "bg-success/15 text-success",
  enabled: "bg-success/15 text-success",
  unblocked: "bg-success/15 text-success",
};

// company.suspended → "company · suspended", coloured by what happened
export function AuditActionBadge({ action }: { action: string }) {
  const [group, verb = ""] = action.split(".");
  return (
    <Badge variant="secondary" className={cn("font-mono text-2xs font-medium whitespace-nowrap", TONES[verb])}>
      {group} · {verb.replace(/_/g, " ")}
    </Badge>
  );
}
