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

export function EmployeesView() {
  const canManage = useCan()("employees.manage");
  const list = useEmployeesStore((s) => s.list);
  const loading = useEmployeesStore((s) => s.loading);
  const load = useEmployeesStore((s) => s.load);
  const remove = useEmployeesStore((s) => s.remove);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const visible = q
    ? list.filter((e) => [e.name, e.employee_code, e.designation, e.department, e.email].some((v) => v?.toLowerCase().includes(q)))
    : list;
  const nameOf = (id: number | null) => list.find((m) => m.id === id)?.name ?? "—";

  function openForm(emp: Employee | null) {
    setEditing(emp);
    setFormOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description={`${list.length} ${list.length === 1 ? "person" : "people"} in your company`}
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
          <Input placeholder="Search by name, code, designation…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" aria-label="Search employees" />
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Reports to</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="w-24">Login</TableHead>
                  {canManage && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2.5">
                        <PersonAvatar name={emp.name} photoUrl={emp.photo_url} />
                        {emp.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.employee_code || "—"}</TableCell>
                    <TableCell>{emp.designation || "—"}</TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell>{nameOf(emp.manager_id)}</TableCell>
                    <TableCell>{fmtDate(emp.join_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(emp.salary)}</TableCell>
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
                    <TableCell colSpan={canManage ? 9 : 8} className="py-8 text-center text-muted-foreground">
                      No employees match “{search}”.
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
