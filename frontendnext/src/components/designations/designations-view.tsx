"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Pencil, Plus, Save } from "lucide-react";
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
import { designationSchema, type DesignationInput } from "@/lib/schemas/designation";
import type { Designation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useDesignationsStore } from "@/stores/designations-store";

// The company's own job titles ("UX Designer", "Accounts Lead"). Shown on
// profiles and payslips — they don't change what anyone can open (that's the role).
export function DesignationsView() {
  const list = useDesignationsStore((s) => s.list);
  const loaded = useDesignationsStore((s) => s.loaded);
  const load = useDesignationsStore((s) => s.load);
  const add = useDesignationsStore((s) => s.add);
  const update = useDesignationsStore((s) => s.update);
  const remove = useDesignationsStore((s) => s.remove);
  const canManage = useCan()("designations.manage");
  const [editing, setEditing] = useState<Designation | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    clearErrors,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DesignationInput>({ resolver: zodResolver(designationSchema), defaultValues: { name: "", status: "active" } });

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(d: Designation) {
    setEditing(d);
    clearErrors();
    setValue("name", d.name);
    setValue("status", d.is_active ? "active" : "inactive");
    setTimeout(() => setFocus("name", { shouldSelect: true }), 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditing(null);
    clearErrors();
    setValue("name", "");
    setValue("status", "active");
  }

  async function onSubmit({ name, status }: DesignationInput) {
    const isActive = status === "active";
    if (editing) {
      const unchanged = name === editing.name && isActive === editing.is_active;
      if (unchanged || (await update(editing.id, { name, isActive }))) reset();
    } else if (await add(name, isActive)) {
      reset();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Designations" description="Your company's job titles. They show on profiles and payslips; access comes from each person's role." className="mb-0" />

      {canManage && (
        <FormCard title={editing ? `Edit “${editing.name}”` : "New designation"} crumbs={["Master", "Designations"]} icon={BadgeCheck}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
            <FormGrid>
              <FormField label="Designation" htmlFor="des-name" error={errors.name} required span="md">
                <Input id="des-name" placeholder="e.g. UX Designer" aria-invalid={Boolean(errors.name)} {...register("name")} />
              </FormField>
              <FormField label="Status" htmlFor="des-status" error={errors.status}>
                <FormSelect
                  control={control}
                  name="status"
                  id="des-status"
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
                  <Button type="button" variant="outline" onClick={reset}>
                    Cancel
                  </Button>
                )}
              </FormActions>
            </FormGrid>
          </form>
        </FormCard>
      )}

      {loaded && list.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="No designations yet" description={canManage ? "Add your company's job titles above." : undefined} />
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading title={`All designations · ${list.filter((d) => d.is_active).length} active of ${list.length}`} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Designation</TableHead>
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
                          description={d.employee_count ? `${d.employee_count} employee${d.employee_count === 1 ? "" : "s"} will have no designation until you pick a new one.` : undefined}
                          onConfirm={async () => {
                            if (editing?.id === d.id) reset();
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
