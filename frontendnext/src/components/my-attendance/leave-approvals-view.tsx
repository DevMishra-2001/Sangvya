"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { MonthPicker } from "@/components/common/month-picker";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import { fmtDay, monthLabel, toMonth } from "@/lib/format";
import { selfService } from "@/lib/services/self";
import type { MyLeavesResponse } from "@/lib/types";
import { useUser } from "@/stores/auth-store";
import { SelectField } from "@/components/common/select-field";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

// My leaves for a month and their approval status (decided by my reporting manager)
export function LeaveApprovalsView() {
  const user = useUser();
  const [month, setMonth] = useState(() => toMonth(new Date()));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [data, setData] = useState<MyLeavesResponse | null>(null);

  useEffect(() => {
    if (!user.employee_id) return;
    run(() => selfService.leaves(month)).then((r) => r.ok && setData(r.data));
  }, [month, user.employee_id]);

  if (!user.employee_id) return <NotLinkedState />;

  const leaves = data?.month === month ? data.leaves : [];
  const visible = filter === "all" ? leaves : leaves.filter((l) => l.status === filter);
  const pendingDays = leaves.filter((l) => l.status === "pending").reduce((s, l) => s + l.days, 0);
  const approvedDays = leaves.filter((l) => l.status === "approved").reduce((s, l) => s + l.days, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Leave approvals — ${monthLabel(month)}`}
        description={`${approvedDays} day${approvedDays === 1 ? "" : "s"} approved · ${pendingDays} pending. Your reporting manager approves or rejects requests.`}
        className="mb-0"
        actions={
          <>
            <SelectField
              className="w-40"
              value={filter}
              onValueChange={(v) => setFilter(v as typeof filter)}
              aria-label="Filter by status"
              options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
            />
            <MonthPicker value={month} onChange={setMonth} allowFuture />
          </>
        }
      />
      {visible.length === 0 ? (
        <EmptyState icon={ClipboardList} title={leaves.length === 0 ? "No leaves this month" : "No leaves match this filter"} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days this month</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Decided by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{LEAVE_TYPE_LABELS[l.leave_type]}</TableCell>
                  <TableCell className="tabular-nums">{fmtDay(l.from_date)}</TableCell>
                  <TableCell className="tabular-nums">{fmtDay(l.to_date)}</TableCell>
                  <TableCell className="tabular-nums">{l.days}</TableCell>
                  <TableCell className="max-w-64 truncate">{l.reason || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={l.status} tone={l.status === "cancelled" ? "neutral" : undefined} />
                  </TableCell>
                  <TableCell>{l.reviewed_by_name || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
