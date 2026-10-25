"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Check, Pencil, Plus, X } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { designationSchema, type DesignationInput } from "@/lib/schemas/designation";
import type { Designation } from "@/lib/types";
import { useDesignationsStore } from "@/stores/designations-store";

function RenameRow({ designation, onDone }: { designation: Designation; onDone: () => void }) {
  const rename = useDesignationsStore((s) => s.rename);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DesignationInput>({ resolver: zodResolver(designationSchema), defaultValues: { name: designation.name } });

  return (
    <form
      onSubmit={handleSubmit(async ({ name }) => {
        if (name === designation.name || (await rename(designation.id, name))) onDone();
      })}
      className="flex items-start gap-1.5"
      noValidate
    >
      <div className="flex-1">
        <Input autoFocus aria-label="Designation name" aria-invalid={Boolean(errors.name)} className="h-7" {...register("name")} />
        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Save" disabled={isSubmitting}>
        <Check />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel" onClick={onDone}>
        <X />
      </Button>
    </form>
  );
}

// The company's job titles. Employees pick one; every company starts with a default list.
export function DesignationsView() {
  const list = useDesignationsStore((s) => s.list);
  const loaded = useDesignationsStore((s) => s.loaded);
  const load = useDesignationsStore((s) => s.load);
  const add = useDesignationsStore((s) => s.add);
  const remove = useDesignationsStore((s) => s.remove);
  const [editingId, setEditingId] = useState<number | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DesignationInput>({ resolver: zodResolver(designationSchema), defaultValues: { name: "" } });

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Designations" description="Job titles you can give employees. Renaming one updates everyone who has it." />
      <Card className="mb-6 max-w-2xl">
        <CardContent>
          <form onSubmit={handleSubmit(async ({ name }) => (await add(name)) && reset())} className="flex items-start gap-3" noValidate>
            <FormField label="New designation" htmlFor="des-name" error={errors.name} className="flex-1">
              <Input id="des-name" placeholder="e.g. DevOps Engineer" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <Button type="submit" className="mt-6" disabled={isSubmitting}>
              <Plus /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {loaded && list.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="No designations yet" />
      ) : (
        <Card className="max-w-2xl py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Designation</TableHead>
                <TableHead className="w-32 text-right">Employees</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{editingId === d.id ? <RenameRow designation={d} onDone={() => setEditingId(null)} /> : d.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.employee_count}</TableCell>
                  <TableCell>
                    {editingId !== d.id && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(d.id)} aria-label={`Rename ${d.name}`}>
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title={`Remove “${d.name}”?`}
                          description={d.employee_count ? `${d.employee_count} employee${d.employee_count === 1 ? "" : "s"} will have no designation until you pick a new one.` : undefined}
                          onConfirm={() => remove(d.id)}
                          label="Remove"
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
