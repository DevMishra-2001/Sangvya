"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Network, Pencil, Plus, Save } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { FormSelect } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { departmentSchema, type DepartmentForm, type DepartmentPayload } from "@/lib/schemas/department";
import type { Department } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useDepartmentsStore } from "@/stores/departments-store";
import { useEmployeesStore } from "@/stores/employees-store";

const EMPTY: DepartmentForm = { name: "", code: "", headId: "", status: "active" };

const toForm = (d: Department): DepartmentForm => ({
  name: d.name,
  code: d.code ?? "",
  headId: d.head_id ? String(d.head_id) : "",
  status: d.is_active ? "active" : "inactive",
});

// The company's departments ("Engineering", "Finance"). Every employee can
// belong to one; it's organisational only — access comes from the role.
export function DepartmentsView() {
  const list = useDepartmentsStore((s) => s.list);
  const loaded = useDepartmentsStore((s) => s.loaded);
  const load = useDepartmentsStore((s) => s.load);
  const save = useDepartmentsStore((s) => s.save);
  const remove = useDepartmentsStore((s) => s.remove);
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const can = useCan();
  const canManage = can("departments.manage");
  const canSeeEmployees = can("employees.view");
  const [editing, setEditing] = useState<Department | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    clearErrors,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentForm, unknown, DepartmentPayload>({ resolver: zodResolver(departmentSchema), defaultValues: EMPTY });

  useEffect(() => {
    load();
    if (canSeeEmployees) loadEmployees();
  }, [load, loadEmployees, canSeeEmployees]);

  // Fill every field (setValue — reset() doesn't refresh inputs reliably here)
  function fill(values: DepartmentForm) {
    clearErrors();
    for (const [key, value] of Object.entries(values)) setValue(key as keyof DepartmentForm, value);
  }

  function startEdit(d: Department) {
    setEditing(d);
    fill(toForm(d));
    setTimeout(() => setFocus("name", { shouldSelect: true }), 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    fill(EMPTY);
  }

  async function onSubmit(payload: DepartmentPayload) {
    if (await save(editing?.id ?? null, payload)) cancelEdit();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Departments" description="How your company is organised. Each employee belongs to one department; access still comes from their role." className="mb-0" />

      {canManage && (
        <FormCard title={editing ? `Edit “${editing.name}”` : "New department"} crumbs={["Master", "Departments"]} icon={Network}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
            <FormGrid>
              <FormField label="Department" htmlFor="dep-name" error={errors.name} required>
                <Input id="dep-name" placeholder="e.g. Engineering" aria-invalid={Boolean(errors.name)} {...register("name")} />
              </FormField>
              <FormField label="Code" htmlFor="dep-code" error={errors.code}>
                <Input id="dep-code" placeholder="e.g. ENG" maxLength={20} className="uppercase" aria-invalid={Boolean(errors.code)} {...register("code")} />
              </FormField>
              <FormField label="Head of department" htmlFor="dep-head" error={errors.headId}>
                <FormSelect
                  control={control}
                  name="headId"
                  id="dep-head"
                  emptyLabel="— None —"
                  options={employees.map((e) => ({ value: String(e.id), label: `${e.name}${e.designation ? ` — ${e.designation}` : ""}` }))}
                />
              </FormField>
              <FormField label="Status" htmlFor="dep-status" error={errors.status}>
                <FormSelect
                  control={control}
                  name="status"
                  id="dep-status"
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                />
              </FormField>
              <FormActions>
                <Button type="submit" disabled={isSubmitting}>
                  {editing ? <Save /> : <Plus />} {editing ? "Update" : "Add"}
                </Button>
                {editing && (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                )}
              </FormActions>
            </FormGrid>
          </form>
        </FormCard>
      )}

      {loaded && list.length === 0 ? (
        <EmptyState icon={Network} title="No departments yet" description={canManage ? "Add your company's departments above." : undefined} />
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading title={`All departments · ${list.filter((d) => d.is_active).length} active of ${list.length}`} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="w-28">Code</TableHead>
                <TableHead>Head</TableHead>
                <TableHead className="w-28 text-right">Employees</TableHead>
                <TableHead className="w-28">Status</TableHead>
                {canManage && <TableHead className="w-24 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((d, i) => (
                <TableRow key={d.id} className={cn(editing?.id === d.id && "bg-primary/8")}>
                  <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                  <TableCell className={cn("font-medium", !d.is_active && "text-muted-foreground")}>{d.name}</TableCell>
                  <TableCell className="font-mono text-xs">{d.code ?? "—"}</TableCell>
                  <TableCell>{d.head_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.employee_count}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? "default" : "secondary"} className="w-16 justify-center">
                      {d.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => startEdit(d)} aria-label={`Edit ${d.name}`}>
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title={`Remove “${d.name}”?`}
                          description={d.employee_count ? `${d.employee_count} employee${d.employee_count === 1 ? "" : "s"} will have no department until you pick a new one.` : undefined}
                          onConfirm={async () => {
                            if (editing?.id === d.id) cancelEdit();
                            await remove(d.id);
                          }}
                          label="Remove"
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
