"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Pencil, Plus, Save, UserCog } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import {
  FieldSeparator,
  FormActions,
  FormCard,
  FormGrid,
  FormHeading,
} from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { FormSelect } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { run } from "@/lib/api/run";
import {
  customRoleSchema,
  type CustomRoleForm,
  type CustomRolePayload,
} from "@/lib/schemas/custom-role";
import { customRolesService } from "@/lib/services/custom-roles";
import type { CustomRole, CustomRolesData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRolesStore } from "@/stores/roles-store";

const EMPTY: CustomRoleForm = {
  name: "",
  base: "employee",
  description: "",
  status: "active",
};

const toForm = (r: CustomRole): CustomRoleForm => ({
  name: r.name,
  base: r.base,
  description: r.description ?? "",
  status: r.is_active ? "active" : "inactive",
});

// Company Admin: own roles (e.g. Team Lead) = a built-in base for rank + the pages it opens
export function CustomRolesView() {
  const [data, setData] = useState<CustomRolesData | null>(null);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [pages, setPages] = useState<Set<number>>(new Set());
  const [pagesError, setPagesError] = useState<string>();
  const reloadRoles = useRolesStore((s) => s.load);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    clearErrors,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CustomRoleForm, unknown, CustomRolePayload>({
    resolver: zodResolver(customRoleSchema),
    defaultValues: EMPTY,
  });
  const base = useWatch({ control, name: "base" });

  const load = useCallback(async () => {
    const r = await run(customRolesService.list);
    if (r.ok) setData(r.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    run(customRolesService.list).then((r) => {
      if (cancelled || !r.ok) return;
      setData(r.data);
      // A new role starts with its base's pages (Dashboard, My Attendance…)
      setPages(
        new Set(r.data.bases.find((b) => b.key === EMPTY.base)?.page_ids ?? []),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pages grouped by their menu group, in menu order
  const groups = useMemo(() => {
    const map = new Map<string, CustomRolesData["pages"]>();
    for (const p of data?.pages ?? []) {
      const g = p.group ?? "Main menu";
      map.set(g, [...(map.get(g) ?? []), p]);
    }
    return [...map.entries()];
  }, [data]);

  const baseInfo = data?.bases.find((b) => b.key === base);
  const nameOfBase = (key: string) =>
    data?.bases.find((b) => b.key === key)?.name ?? key;

  function fill(values: CustomRoleForm, pageIds: number[]) {
    clearErrors();
    setPagesError(undefined);
    for (const [key, value] of Object.entries(values))
      setValue(key as keyof CustomRoleForm, value);
    setPages(new Set(pageIds));
  }

  function startEdit(r: CustomRole) {
    setEditing(r);
    fill(toForm(r), r.page_ids);
    setTimeout(() => setFocus("name", { shouldSelect: true }), 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    fill(EMPTY, data?.bases.find((b) => b.key === EMPTY.base)?.page_ids ?? []);
  }

  function toggle(ids: number[], on: boolean) {
    setPagesError(undefined);
    setPages((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function onSubmit(payload: CustomRolePayload) {
    if (pages.size === 0) return setPagesError("Pick at least one page");
    const body = { ...payload, pageIds: [...pages] };
    const r = await run(
      () =>
        editing
          ? customRolesService.update(editing.id, body)
          : customRolesService.create(body),
      {
        success: editing ? "Role updated" : "Role created",
      },
    );
    if (!r.ok) return;
    cancelEdit();
    await load();
    reloadRoles();
  }

  async function remove(r: CustomRole) {
    const res = await run(() => customRolesService.remove(r.id), {
      success: "Role removed",
    });
    if (!res.ok) return;
    if (editing?.id === r.id) cancelEdit();
    await load();
    reloadRoles();
  }

  if (!data) {
    return (
      <div
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Loading roles"
      >
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Custom Roles"
        description="Make your own roles, like Team Lead or Payroll Clerk. Pick a built-in role it's based on (its rank), then the pages it can open."
        className="mb-0"
      />

      <FormCard
        title={editing ? `Edit “${editing.name}”` : "New role"}
        crumbs={["Master", "Custom Roles"]}
        icon={UserCog}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid>
            <FormField
              label="Role name"
              htmlFor="cr-name"
              error={errors.name}
              required
            >
              <Input
                id="cr-name"
                placeholder="e.g. Team Lead"
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
            </FormField>
            <FormField
              label="Based on"
              htmlFor="cr-base"
              error={errors.base}
              required
              description={
                base === "hr"
                  ? "HR rank: sees and approves leave company-wide"
                  : "Rank for who can manage whom"
              }
            >
              <FormSelect
                control={control}
                name="base"
                id="cr-base"
                options={data.bases.map((b) => ({
                  value: b.key,
                  label: b.name,
                }))}
              />
            </FormField>
            <FormField label="Status" htmlFor="cr-status" error={errors.status}>
              <FormSelect
                control={control}
                name="status"
                id="cr-status"
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </FormField>
            <FormField
              label="Description"
              htmlFor="cr-desc"
              error={errors.description}
            >
              <Input
                id="cr-desc"
                placeholder="Optional"
                maxLength={200}
                {...register("description")}
              />
            </FormField>

            <FieldSeparator
              label={`Pages it can open · ${pages.size} selected`}
            />
            <div className="col-span-12 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!baseInfo}
                onClick={() => baseInfo && setPages(new Set(baseInfo.page_ids))}
              >
                <Copy /> Use {baseInfo?.name ?? "base"}&apos;s pages
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  toggle(
                    data.pages.map((p) => p.id),
                    true,
                  )
                }
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPages(new Set())}
              >
                Clear
              </Button>
              {pagesError && (
                <span className="text-sm text-destructive">{pagesError}</span>
              )}
            </div>
            <div className="col-span-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {groups.map(([group, list]) => {
                const all = list.every((p) => pages.has(p.id));
                return (
                  <fieldset
                    key={group}
                    className={cn(
                      "rounded-lg border p-3",
                      pagesError && "border-destructive/50",
                    )}
                  >
                    <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase">
                      <label className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={
                            all
                              ? true
                              : list.some((p) => pages.has(p.id))
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={() =>
                            toggle(
                              list.map((p) => p.id),
                              !all,
                            )
                          }
                          aria-label={`All pages in ${group}`}
                        />
                        {group}
                      </label>
                    </legend>
                    <div className="flex flex-col gap-2">
                      {list.map((p) => (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={pages.has(p.id)}
                            onCheckedChange={(v) => toggle([p.id], v === true)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <p className="col-span-12 -mt-2 text-xs text-muted-foreground">
              Keep the everyday pages (Dashboard, My Attendance, Leave, Tickets)
              ticked so people don&apos;t lose them. Changes apply at their next
              sign-in or session refresh.
            </p>

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

      {data.roles.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No custom roles yet"
          description="Built-in roles (Admin, HR, Accountant, Employee) are always available. Add your own above."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading
            title={`Custom roles · ${data.roles.filter((r) => r.is_active).length} active of ${data.roles.length}`}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-36">Based on</TableHead>
                <TableHead className="w-24 text-right">Pages</TableHead>
                <TableHead className="w-28 text-right">Employees</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.roles.map((r, i) => (
                <TableRow
                  key={r.id}
                  className={cn(editing?.id === r.id && "bg-primary/8")}
                >
                  <TableCell className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-medium",
                        !r.is_active && "text-muted-foreground",
                      )}
                    >
                      {r.name}
                    </span>
                    {r.description && (
                      <span className="block text-xs text-muted-foreground">
                        {r.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{nameOfBase(r.base)}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.page_ids.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.employee_count}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.is_active ? "default" : "secondary"}
                      className="w-16 justify-center"
                    >
                      {r.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEdit(r)}
                        aria-label={`Edit ${r.name}`}
                      >
                        <Pencil />
                      </Button>
                      <ConfirmDelete
                        title={`Remove “${r.name}”?`}
                        description={
                          r.employee_count
                            ? `${r.employee_count} employee${r.employee_count === 1 ? " has" : "s have"} this role — give them another role first.`
                            : "This can't be undone."
                        }
                        onConfirm={() => remove(r)}
                        label="Remove"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
