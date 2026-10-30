"use client";

import { useEffect, useState } from "react";
import { Ban, CalendarClock, Check, Plus, Undo2, X } from "lucide-react";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SHORT_LEAVE_LABELS } from "@/lib/constants";
import { fmtDate, isoDate } from "@/lib/format";
import type { Leave } from "@/lib/types";
import { useCan, useUser } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { useLeavesStore } from "@/stores/leaves-store";
import { LeaveBalancesTable } from "./leave-balances-table";
import { LeaveRequestDialog } from "./leave-request-dialog";

const STATUS_FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
] as const;

function LeaveRow({ l, myEmployeeId, isHr, today }: { l: Leave; myEmployeeId: number | null; isHr: boolean; today: string }) {
  const decide = useLeavesStore((s) => s.decide);
  const cancel = useLeavesStore((s) => s.cancel);
  const [note, setNote] = useState("");
  const mine = l.employee_id === myEmployeeId;
  // Mine: withdraw while pending, cancel an approved one that hasn't started. HR: any pending / approved.
  const canCancel = (l.status === "pending" || (l.status === "approved" && (isHr || l.from_date > today))) && (mine || isHr);
  const waitingOn = l.approver === "manager" && l.manager_name ? l.manager_name : "HR";

  return (
    <Card className="py-3.5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {l.employee_name}
            <Badge variant="outline">{SHORT_LEAVE_LABELS[l.leave_type] ?? "Leave"}</Badge>
            {l.half_day && <Badge variant="secondary">{l.half_day === "first" ? "First half" : "Second half"}</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(l.from_date)}
            {l.to_date !== l.from_date && ` → ${fmtDate(l.to_date)}`}
            {l.reason && ` · ${l.reason}`}
          </div>
          {(l.review_note || (l.status !== "pending" && l.reviewed_by_name)) && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {l.reviewed_by_name && `${l.status === "cancelled" ? "Reviewed" : l.status[0].toUpperCase() + l.status.slice(1)} by ${l.reviewed_by_name}`}
              {l.review_note && ` · “${l.review_note}”`}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {l.status === "pending" && l.can_decide ? (
            <>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-8 w-40" maxLength={500} aria-label={`Note for ${l.employee_name}`} />
              <Button variant="outline" size="sm" className="border-success/40 text-success hover:bg-success/10" onClick={() => decide(l.id, "approved", note || undefined)}>
                <Check /> Approve
              </Button>
              <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => decide(l.id, "rejected", note || undefined)}>
                <X /> Reject
              </Button>
            </>
          ) : (
            <>
              {l.status === "pending" && <span className="text-xs text-muted-foreground">{mine ? `Waiting for ${waitingOn}` : l.approver === "manager" ? `With ${l.manager_name ?? "their manager"}` : "Needs HR"}</span>}
              <StatusBadge status={l.status} tone={l.status === "cancelled" ? "neutral" : undefined} />
            </>
          )}
          {canCancel && (
            <Button variant="ghost" size="sm" onClick={() => cancel(l.id, mine)} title={mine && l.status === "pending" ? "Withdraw this request" : "Cancel this leave — the days go back to the balance"}>
              {mine && l.status === "pending" ? <Undo2 /> : <Ban />} {mine && l.status === "pending" ? "Withdraw" : "Cancel"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LeaveView() {
  const can = useCan();
  const user = useUser();
  const leaves = useLeavesStore((s) => s.list);
  const load = useLeavesStore((s) => s.load);
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["value"]>("pending");
  const [today] = useState(() => isoDate(new Date()));

  const forOthers = can("leave.applyForOthers");
  const viewAll = can("leave.viewAll");
  // Can apply if they may pick any employee, or their login is linked to an employee record
  const canApply = forOthers ? employees.length > 0 : Boolean(user.employee_id);

  useEffect(() => {
    if (forOthers) loadEmployees();
    load();
  }, [forOthers, load, loadEmployees]);

  const visible = leaves.filter((l) =>
    filter === "all" ? true : filter === "pending" ? l.status === "pending" : (l.status === "approved" || l.status === "pending") && l.to_date >= today,
  );
  const pendingCount = leaves.filter((l) => l.status === "pending").length;

  const requests =
    !forOthers && !user.employee_id ? (
      <NotLinkedState />
    ) : (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button key={f.value} size="sm" variant={filter === f.value ? "secondary" : "ghost"} onClick={() => setFilter(f.value)}>
              {f.label}
              {f.value === "pending" && pendingCount > 0 && ` · ${pendingCount}`}
            </Button>
          ))}
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={CalendarClock} title={filter === "pending" ? "Nothing waiting" : "No leave requests"} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((l) => (
              <LeaveRow key={l.id} l={l} myEmployeeId={user.employee_id} isHr={forOthers} today={today} />
            ))}
          </div>
        )}
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Leave"
        description={
          viewAll
            ? "Every leave request in your company. Each one is decided by the employee's reporting manager — HR only when they have none."
            : user.team_size
              ? "Your leave requests and your team's — you approve your team's."
              : "Your leave requests. Your reporting manager approves them."
        }
        actions={
          <Button disabled={!canApply} onClick={() => setFormOpen(true)}>
            <Plus /> New request
          </Button>
        }
      />
      {viewAll ? (
        <Tabs defaultValue="requests">
          <TabsList className="mb-4">
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
          </TabsList>
          <TabsContent value="requests">{requests}</TabsContent>
          <TabsContent value="balances">
            <LeaveBalancesTable />
          </TabsContent>
        </Tabs>
      ) : (
        requests
      )}
      <LeaveRequestDialog open={formOpen} onOpenChange={setFormOpen} employees={forOthers ? employees.filter((e) => e.status !== "exited") : null} defaultEmployeeId={user.employee_id} />
    </div>
  );
}
