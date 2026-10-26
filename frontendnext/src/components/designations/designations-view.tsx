"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Pencil, Save } from "lucide-react";
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
import { useDesignationsStore } from "@/stores/designations-store";

// The five fixed designations. They decide what each person can open (set per
// page in the Page Master). Only their name and status can change.
export function DesignationsView() {
  const list = useDesignationsStore((s) => s.list);
  const load = useDesignationsStore((s) => s.load);
  const update = useDesignationsStore((s) => s.update);
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

  function cancelEdit() {
    setEditing(null);
    clearErrors();
    setValue("name", "");
    setValue("status", "active");
  }

  async function onSubmit({ name, status }: DesignationInput) {
    if (!editing) return;
    const isActive = status === "active";
    const unchanged = name === editing.name && isActive === editing.is_active;
    if (unchanged || (await update(editing.id, { name, isActive }))) cancelEdit();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Designations" description="The fixed designations. What each one can open is set in the Page Master." className="mb-0" />

      <FormCard title={editing ? `Edit “${editing.name}”` : "Edit designation"} crumbs={["Master", "Designations"]} icon={BadgeCheck}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid>
            <FormField label="Designation" htmlFor="des-name" error={errors.name} required span="md">
              <Input id="des-name" disabled={!editing} aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Status" htmlFor="des-status" error={errors.status}>
              <FormSelect
                control={control}
                name="status"
                id="des-status"
                disabled={!editing || editing.key === "superadmin"}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </FormField>
            <FormActions>
              <Button type="submit" disabled={!editing || isSubmitting}>
                <Save /> Update
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </FormActions>
          </FormGrid>
          {!editing && <p className="mt-3 text-xs text-muted-foreground">Pick a designation below to rename it or change its status.</p>}
        </form>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title={`All designations · ${list.filter((d) => d.is_active).length} active of ${list.length}`} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead className="w-24">Level</TableHead>
              <TableHead className="w-28 text-right">Employees</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((d, i) => (
              <TableRow key={d.id} className={cn(editing?.id === d.id && "bg-primary/8")}>
                <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell className={cn("font-medium", !d.is_active && "text-muted-foreground")}>{d.name}</TableCell>
                <TableCell className="tabular-nums">{d.level}</TableCell>
                <TableCell className="text-right tabular-nums">{d.employee_count}</TableCell>
                <TableCell>
                  <Badge variant={d.is_active ? "default" : "secondary"} className="w-16 justify-center">
                    {d.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(d)} aria-label={`Edit ${d.name}`}>
                      <Pencil />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
