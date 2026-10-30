import { Badge } from "@/components/ui/badge";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { Employee } from "@/lib/types";

// Active / On notice (with the last day) / Left
export function EmployeeStatusBadge({ employee }: { employee: Pick<Employee, "status" | "exit_date"> }) {
  const { status, exit_date } = employee;
  const variant = status === "active" ? "secondary" : status === "notice" ? "outline" : "destructive";
  return (
    <Badge variant={variant} className={status === "notice" ? "border-warning/60 text-warning" : undefined} title={exit_date ? `Last working day ${fmtDate(exit_date)}` : undefined}>
      {EMPLOYEE_STATUS_LABELS[status]}
    </Badge>
  );
}
