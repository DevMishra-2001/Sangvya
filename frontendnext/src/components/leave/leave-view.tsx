"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, Plus, X } from "lucide-react";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SHORT_LEAVE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { useCan, useUser } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { useLeavesStore } from "@/stores/leaves-store";
import { LeaveRequestDialog } from "./leave-request-dialog";

export function LeaveView() {
  const can = useCan();
  const user = useUser();
  const leaves = useLeavesStore((s) => s.list);
  const load = useLeavesStore((s) => s.load);
  const decide = useLeavesStore((s) => s.decide);
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const [formOpen, setFormOpen] = useState(false);

  const forOthers = can("leave.applyForOthers");
  const canApprove = can("leave.approve");
  // Can apply if they may pick any employee, or their login is linked to an employee record
  const canApply = forOthers ? employees.length > 0 : Boolean(user.employee_id);

  useEffect(() => {
    if (forOthers) loadEmployees();
    load();
  }, [forOthers, load, loadEmployees]);

  return (
    <div>
      <PageHeader
        title="Leave"
        description={can("leave.viewAll") ? "Every leave request in your company." : "Your leave requests."}
        actions={
          <Button disabled={!canApply} onClick={() => setFormOpen(true)}>
            <Plus /> New request
          </Button>
        }
      />
      {!forOthers && !user.employee_id ? (
        <NotLinkedState />
      ) : leaves.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No leave requests yet" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {leaves.map((l) => (
            <Card key={l.id} className="py-3.5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {l.employee_name}
                    <Badge variant="outline">{SHORT_LEAVE_LABELS[l.leave_type] ?? "Leave"}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDate(l.from_date)}
                    {l.to_date !== l.from_date && ` → ${fmtDate(l.to_date)}`}
                    {l.reason && ` · ${l.reason}`}
                  </div>
                </div>
                {l.status === "pending" && canApprove && l.employee_id !== user.employee_id ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-success/40 text-success hover:bg-success/10" onClick={() => decide(l.id, "approved")}>
                      <Check /> Approve
                    </Button>
                    <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => decide(l.id, "rejected")}>
                      <X /> Reject
                    </Button>
                  </div>
                ) : (
                  <StatusBadge status={l.status} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <LeaveRequestDialog open={formOpen} onOpenChange={setFormOpen} employees={forOthers ? employees : null} defaultEmployeeId={user.employee_id} />
    </div>
  );
}
