"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LEVEL, type Role } from "@/lib/permissions";
import type { Employee, UserRow } from "@/lib/types";
import { useAuthStore, useUser } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { useUsersStore } from "@/stores/users-store";
import { UserFormDialog } from "./user-form-dialog";
import { SelectField } from "@/components/common/select-field";
import { ROLE_LABELS } from "@/lib/constants";

// Roles this user may hand out (the backend enforces the same rule)
function assignableRoles(myRole: Role, roles: Role[]) {
  return myRole === "superadmin" ? roles : roles.filter((r) => ROLE_LEVEL[r] < ROLE_LEVEL[myRole]);
}

// Employees without a login yet (plus the one already linked to `current`)
function linkableEmployees(employees: Employee[], users: UserRow[], current?: UserRow) {
  const linked = new Set(users.filter((u) => u.employee_id && u.id !== current?.id).map((u) => u.employee_id));
  return employees.filter((e) => !linked.has(e.id));
}

export function UsersView() {
  const me = useUser();
  const loadMe = useAuthStore((s) => s.loadMe);
  const users = useUsersStore((s) => s.list);
  const roles = useUsersStore((s) => s.roles);
  const loadUsers = useUsersStore((s) => s.load);
  const update = useUsersStore((s) => s.update);
  const remove = useUsersStore((s) => s.remove);
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    loadUsers();
    loadEmployees();
  }, [loadUsers, loadEmployees]);

  const myRoles = assignableRoles(me.role, roles);
  const canManage = (u: UserRow) => u.id !== me.id && (me.role === "superadmin" || ROLE_LEVEL[u.role] < ROLE_LEVEL[me.role]);

  async function relink(u: UserRow, value: string) {
    const ok = await update(u.id, { employeeId: value ? Number(value) : null });
    if (ok && u.id === me.id) loadMe(); // my own employee link changed
  }

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Who can log in, and what their role is."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> Add user
          </Button>
        }
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Linked employee</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const editable = canManage(u);
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {u.id === me.id && <span className="text-xs font-normal text-muted-foreground"> (you)</span>}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {editable ? (
                      <SelectField
                        size="sm"
                        className="w-auto"
                        value={u.role}
                        onValueChange={(v) => update(u.id, { role: v as Role })}
                        aria-label={`Role of ${u.name}`}
                        options={myRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))}
                      />
                    ) : (
                      <span className="capitalize">{u.role}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editable || u.id === me.id ? (
                      <SelectField
                        size="sm"
                        className="w-auto min-w-36"
                        value={u.employee_id ? String(u.employee_id) : ""}
                        onValueChange={(v) => relink(u, v)}
                        aria-label={`Employee linked to ${u.name}`}
                        emptyLabel="— Not linked —"
                        options={linkableEmployees(employees, users, u).map((emp) => ({ value: String(emp.id), label: emp.name }))}
                      />
                    ) : (
                      u.employee_name || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {editable && <ConfirmDelete title={`Delete ${u.name}'s login?`} description="They won't be able to log in any more. Their employee record stays." onConfirm={() => remove(u.id)} />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} roles={myRoles} employees={linkableEmployees(employees, users)} />
    </div>
  );
}
