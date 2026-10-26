"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Employee, UserRow } from "@/lib/types";
import { useUser } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { useUsersStore } from "@/stores/users-store";
import { UserFormDialog } from "./user-form-dialog";

// Employees without a login yet (plus the one already linked to `current`)
function linkableEmployees(employees: Employee[], users: UserRow[], current?: UserRow) {
  const linked = new Set(users.filter((u) => u.employee_id && u.id !== current?.id).map((u) => u.employee_id));
  return employees.filter((e) => !linked.has(e.id));
}

// Logins. What each person can open comes from their employee's designation
// (Employees page) and the Page Master — there's no separate role here.
export function UsersView() {
  const me = useUser();
  const users = useUsersStore((s) => s.list);
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

  // Same rule as the backend: logins at or below my level, never the Super Admin, never myself
  const myLevel = me.is_superadmin ? 99 : (me.designation?.level ?? 0);
  const canManage = (u: UserRow) => u.id !== me.id && (me.is_superadmin || (!u.is_superadmin && (u.designation_level ?? 0) <= myLevel));

  return (
    <div>
      <PageHeader
        title="Users"
        description="Who can log in. Their access comes from their designation."
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
              <TableHead>Designation</TableHead>
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
                    {u.is_superadmin ? (
                      <Badge>Super Admin</Badge>
                    ) : u.designation ? (
                      <Badge variant="secondary">{u.designation}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <SelectField
                        size="sm"
                        className="w-auto min-w-36"
                        value={u.employee_id ? String(u.employee_id) : ""}
                        onValueChange={(v) => update(u.id, { employeeId: v ? Number(v) : null })}
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
      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} employees={linkableEmployees(employees, users)} />
    </div>
  );
}
