"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LayoutList, Pencil, Plus, Save } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { FormMultiSelect } from "@/components/common/multi-select";
import { PageHeader } from "@/components/common/page-header";
import { FormSelect } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_ICON_NAMES, pageIcon } from "@/lib/page-icons";
import { pageSchema, slugify, type PageForm, type PagePayload } from "@/lib/schemas/page";
import type { PageRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRolesStore } from "@/stores/roles-store";
import { usePagesStore } from "@/stores/pages-store";

const EMPTY: PageForm = {
  name: "",
  slug: "",
  url: "",
  icon: "",
  parentId: "",
  sortOrder: "",
  showInMenu: "yes",
  isActive: "active",
  roleIds: [],
};

const toForm = (p: PageRow): PageForm => ({
  name: p.name,
  slug: p.slug,
  url: p.url ?? "",
  icon: p.icon ?? "",
  parentId: p.parent_id ? String(p.parent_id) : "",
  sortOrder: String(p.sort_order),
  showInMenu: p.show_in_menu ? "yes" : "no",
  isActive: p.is_active ? "active" : "inactive",
  roleIds: p.role_ids.map(String),
});

// Rows in menu order: each top-level page followed by its children
function ordered(list: PageRow[]) {
  const top = list.filter((p) => !p.parent_id || !list.some((x) => x.id === p.parent_id));
  return top.flatMap((p) => [{ page: p, depth: 0 }, ...list.filter((c) => c.parent_id === p.id).map((c) => ({ page: c, depth: 1 }))]);
}

// Super Admin: every page of the app, its menu place, and which roles can open it.
// What people see in the sidebar (and can open) comes from here.
export function PageMasterView() {
  const pages = usePagesStore((s) => s.list);
  const load = usePagesStore((s) => s.load);
  const save = usePagesStore((s) => s.save);
  const remove = usePagesStore((s) => s.remove);
  const roles = useRolesStore((s) => s.list);
  const loadRoles = useRolesStore((s) => s.load);
  const [editing, setEditing] = useState<PageRow | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    clearErrors,
    getValues,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<PageForm, unknown, PagePayload>({ resolver: zodResolver(pageSchema), defaultValues: EMPTY });

  useEffect(() => {
    load();
    loadRoles();
  }, [load, loadRoles]);

  // Fill every field (setValue — reset() doesn't refresh inputs reliably here)
  function fill(values: PageForm) {
    clearErrors();
    for (const [key, value] of Object.entries(values)) setValue(key as keyof PageForm, value as never);
  }

  function startEdit(p: PageRow) {
    setEditing(p);
    fill(toForm(p));
    setTimeout(() => setFocus("name", { shouldSelect: true }), 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    fill(EMPTY);
  }

  async function onSubmit(payload: PagePayload) {
    if (await save(editing?.id ?? null, payload)) cancelEdit();
  }

  // Suggest a slug from the name while adding (only if the slug is still empty)
  const nameField = register("name", {
    onBlur: () => {
      if (!editing && !getValues("slug")) setValue("slug", slugify(getValues("name")));
    },
  });

  const roleName = (id: number) => roles.find((r) => r.id === id)?.name ?? "?";
  const groups = pages.filter((p) => !p.url && p.id !== editing?.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Page Master" description="Every page of the app and which roles can open it. The menu is built from this list." className="mb-0" />

      <FormCard title={editing ? `Edit “${editing.name}”` : "New page"} crumbs={["Master", "Page Master"]} icon={LayoutList}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid>
            <FormField label="Page name" htmlFor="pg-name" error={errors.name} required>
              <Input id="pg-name" placeholder="e.g. Leave Policy" aria-invalid={Boolean(errors.name)} {...nameField} />
            </FormField>
            <FormField label="URL" htmlFor="pg-url" error={errors.url}>
              <Input id="pg-url" placeholder="/leave-policy — empty for a menu group" aria-invalid={Boolean(errors.url)} {...register("url")} />
            </FormField>
            <FormField label="Slug" htmlFor="pg-slug" error={errors.slug} required>
              <Input id="pg-slug" placeholder="leave-policy" aria-invalid={Boolean(errors.slug)} {...register("slug")} />
            </FormField>
            <FormField label="Icon" htmlFor="pg-icon" error={errors.icon}>
              <FormSelect
                control={control}
                name="icon"
                id="pg-icon"
                emptyLabel="— None —"
                options={PAGE_ICON_NAMES.map((name) => {
                  const Icon = pageIcon(name);
                  return {
                    value: name,
                    label: (
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" /> {name}
                      </span>
                    ),
                  };
                })}
              />
            </FormField>
            <FormField label="Inside group" htmlFor="pg-parent" error={errors.parentId}>
              <FormSelect control={control} name="parentId" id="pg-parent" emptyLabel="— Top level —" options={groups.map((g) => ({ value: String(g.id), label: g.name }))} />
            </FormField>
            <FormField label="Order" htmlFor="pg-order" error={errors.sortOrder}>
              <Input id="pg-order" inputMode="numeric" placeholder="0" {...register("sortOrder")} />
            </FormField>
            <FormField label="Roles" htmlFor="pg-access" error={errors.roleIds as { message?: string } | undefined} span="md">
              <FormMultiSelect
                control={control}
                name="roleIds"
                id="pg-access"
                placeholder="Who can open it"
                options={roles.filter((r) => r.key !== "superadmin" && !r.company_id).map((r) => ({ value: String(r.id), label: r.name }))}
              />
            </FormField>
            <FormField label="In menu" htmlFor="pg-menu" error={errors.showInMenu}>
              <FormSelect
                control={control}
                name="showInMenu"
                id="pg-menu"
                options={[
                  { value: "yes", label: "Show in menu" },
                  { value: "no", label: "Hidden (link only)" },
                ]}
              />
            </FormField>
            <FormField label="Status" htmlFor="pg-status" error={errors.isActive}>
              <FormSelect
                control={control}
                name="isActive"
                id="pg-status"
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
          <p className="mt-3 text-xs text-muted-foreground">Super Admin always sees every page. A new URL needs its screen built in the app before it opens.</p>
        </form>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title={`All pages · ${pages.filter((p) => p.is_active).length} active of ${pages.length}`} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Order</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="w-24">Menu</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered(pages).map(({ page: p, depth }) => {
              const Icon = pageIcon(p.icon);
              return (
                <TableRow key={p.id} className={cn(editing?.id === p.id && "bg-primary/8")}>
                  <TableCell className="text-muted-foreground tabular-nums">{p.sort_order}</TableCell>
                  <TableCell className={cn("font-medium", !p.is_active && "text-muted-foreground")}>
                    <span className={cn("flex items-center gap-2", depth && "pl-6")}>
                      <Icon className="size-4 text-muted-foreground" />
                      {p.name}
                      {!p.url && <Badge variant="outline">Group</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.url ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.role_ids.length ? (
                        p.role_ids.map((id) => (
                          <Badge key={id} variant="secondary">
                            {roleName(id)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Super Admin only</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{p.show_in_menu ? "Shown" : "Hidden"}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"} className="w-16 justify-center">
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`}>
                        <Pencil />
                      </Button>
                      <ConfirmDelete
                        title={`Remove “${p.name}”?`}
                        description={!p.url ? "Pages inside this group move to the top level." : "Nobody will see it in the menu any more."}
                        onConfirm={async () => {
                          if (editing?.id === p.id) cancelEdit();
                          await remove(p.id);
                        }}
                        label="Remove"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
