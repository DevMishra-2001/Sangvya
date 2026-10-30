"use client";

import { PersonAvatar } from "@/components/common/person-avatar";
import { useEffect, useState } from "react";
import { Pencil, Plus, Users } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, inr } from "@/lib/format";
import type { Employee } from "@/lib/types";
import { useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { SelectField } from "@/components/common/select-field";
import Link from "next/link";

export function EmployeesView() {
  const canManage = useCan()("employees.manage");
  const list = useEmployeesStore((s) => s.list);
  const loading = useEmployeesStore((s) => s.loading);
  const load = useEmployeesStore((s) => s.load);
  const remove = useEmployeesStore((s) => s.remove);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  // current = active + on notice (people who left are hidden unless asked for)
  const [status, setStatus] = useState("current");

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const visible = list.filter(
    (e) =>
      (status === "all" || (status === "current" ? e.status !== "exited" : e.status === status)) &&
      (!q || [e.name, e.employee_code, e.designation, e.department, e.email].some((v) => v?.toLowerCase().includes(q))),
  );
  const current = list.filter((e) => e.status !== "exited").length;
  const nameOf = (id: number | null) => list.find((m) => m.id === id)?.name ?? "—";

  function openForm(emp: Employee | null) {
    setEditing(emp);
    setFormOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description={`${current} ${current === 1 ? "person" : "people"} in your company${list.length > current ? ` · ${list.length - current} left` : ""}`}
        actions={
          canManage && (
            <Button onClick={() => openForm(null)}>
              <Plus /> Add employee
            </Button>
          )
        }
      />

      {loading && list.length === 0 ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : list.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet" description={canManage ? 'Click "Add employee" to get started.' : undefined} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Input placeholder="Search by name, code, designation…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" aria-label="Search employees" />
            <SelectField
              className="w-40"
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "current", label: "Current staff" },
                { value: "active", label: "Active" },
                { value: "notice", label: "On notice" },
                { value: "exited", label: "Left" },
                { value: "all", label: "Everyone" },
              ]}
              aria-label="Filter by status"
            />
          </div>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Reports to</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Login</TableHead>
                  {canManage && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      <Link href={`/employees/${emp.id}`} className="flex items-center gap-2.5 hover:text-primary hover:underline">
                        <PersonAvatar name={emp.name} photoUrl={emp.photo_url} />
                        {emp.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.employee_code || "—"}</TableCell>
                    <TableCell>{emp.designation || "—"}</TableCell>
                    <TableCell>{emp.role ? <Badge variant="outline">{emp.role}</Badge> : "—"}</TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell>{nameOf(emp.manager_id)}</TableCell>
                    <TableCell>{fmtDate(emp.join_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(emp.salary)}</TableCell>
                    <TableCell>
                      <EmployeeStatusBadge employee={emp} />
                    </TableCell>
                    <TableCell>
                      {emp.has_login ? (
                        <Badge variant={emp.login_blocked ? "destructive" : "secondary"}>{emp.login_blocked ? "Blocked" : "Active"}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openForm(emp)} aria-label={`Edit ${emp.name}`}>
                            <Pencil />
                          </Button>
                          <ConfirmDelete
                            title={`Remove ${emp.name}?`}
                            description="Their attendance, leaves, payslips and reviews are deleted too. This can't be undone."
                            onConfirm={() => remove(emp.id)}
                            label="Remove"
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManage ? 11 : 10} className="py-8 text-center text-muted-foreground">
                      No employees match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} />
    </div>
  );
}
