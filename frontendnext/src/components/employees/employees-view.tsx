"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Upload, Users } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { PersonAvatar } from "@/components/common/person-avatar";
import { SelectField } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate, inr } from "@/lib/format";
import { employeesService } from "@/lib/services/employees";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { EmployeeStatusBadge } from "./employee-status-badge";

type PageData = Awaited<ReturnType<typeof employeesService.page>>;

// Employees: searched, filtered and paged on the server (?page=&limit=&search=&status=)
export function EmployeesView() {
  const router = useRouter();
  const canManage = useCan()("employees.manage");
  const remove = useEmployeesStore((s) => s.remove);
  const url = useUrlParams();
  const page = url.getNumber("page", 1);
  const limit = url.getNumber("limit", 20);
  const status = url.get("status", "current");
  const search = url.get("search");
  const [typed, setTyped] = useState(search);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await run(() => employeesService.page({ page, limit, status, search: search || undefined }));
    setLoading(false);
    if (r.ok) setData(r.data);
  }, [page, limit, status, search]);

  useEffect(() => {
    let cancelled = false;
    run(() => employeesService.page({ page, limit, status, search: search || undefined })).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [page, limit, status, search]);

  // Search goes to the URL (and the server) once typing pauses
  useEffect(() => {
    const t = setTimeout(() => typed.trim() !== search && url.set({ search: typed.trim(), page: null }), 350);
    return () => clearTimeout(t);
  }, [typed, search, url]);

  function openForm(emp: Employee | null) {
    setEditing(emp);
    setFormOpen(true);
  }

  // The dialog closed: show any change it made
  function onFormOpenChange(open: boolean) {
    setFormOpen(open);
    if (!open) load();
  }

  async function removeOne(emp: Employee) {
    await remove(emp.id);
    load();
  }

  const empty = data && data.total === 0 && !search && status === "current";

  return (
    <div>
      <PageHeader
        title="Employees"
        description={data ? `${data.total} ${data.total === 1 ? "person" : "people"}${status === "current" ? " in your company" : ""}` : "Loading…"}
        actions={
          canManage && (
            <>
              <Button variant="outline" asChild>
                <Link href="/employees/import">
                  <Upload /> Import
                </Link>
              </Button>
              <Button onClick={() => openForm(null)}>
                <Plus /> Add employee
              </Button>
            </>
          )
        }
      />

      {!data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : empty ? (
        <EmptyState icon={Users} title="No employees yet" description={canManage ? 'Click "Add employee" to get started.' : undefined} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name, code, email, designation…" value={typed} onChange={(e) => setTyped(e.target.value)} className="pl-8" aria-label="Search employees" />
            </div>
            <SelectField
              className="w-40"
              value={status}
              onValueChange={(v) => url.set({ status: v === "current" ? null : v, page: null })}
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
          <Card className="gap-0 overflow-hidden py-0">
            <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Reports to</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-24">Login</TableHead>
                    {canManage && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.employees.map((emp) => (
                    <TableRow key={emp.id} className="cursor-pointer" onClick={() => router.push(`/employees/${emp.id}`)}>
                      <TableCell className="font-medium">
                        <Link href={`/employees/${emp.id}`} onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-2.5 hover:text-primary hover:underline">
                          <PersonAvatar name={emp.name} photoUrl={emp.photo_url} />
                          {emp.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{emp.employee_code || "—"}</TableCell>
                      <TableCell>{emp.designation || "—"}</TableCell>
                      <TableCell>{emp.role ? <Badge variant="outline">{emp.role}</Badge> : "—"}</TableCell>
                      <TableCell>{emp.department || "—"}</TableCell>
                      <TableCell>{emp.branch || "—"}</TableCell>
                      <TableCell>{emp.manager_name || "—"}</TableCell>
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
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openForm(emp)} aria-label={`Edit ${emp.name}`}>
                              <Pencil />
                            </Button>
                            <ConfirmDelete
                              title={`Remove ${emp.name}?`}
                              description="Their attendance, leaves, payslips and reviews are deleted too. This can't be undone."
                              onConfirm={() => removeOne(emp)}
                              label="Remove"
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {data.employees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canManage ? 12 : 11} className="py-8 text-center text-muted-foreground">
                        No employees match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <Pagination
              className="border-t"
              page={data.page}
              limit={data.limit}
              total={data.total}
              onPageChange={(p) => url.set({ page: p === 1 ? null : p })}
              onLimitChange={(l) => url.set({ limit: l === 20 ? null : l, page: null })}
            />
          </Card>
        </>
      )}

      <EmployeeFormDialog open={formOpen} onOpenChange={onFormOpenChange} employee={editing} />
    </div>
  );
}
