"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, UserCog } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { PasswordChecklist } from "@/components/common/password-checklist";
import { PasswordInput } from "@/components/common/password-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import { adminSchema, type AdminInput } from "@/lib/schemas/admin";
import { useAdminsStore } from "@/stores/admins-store";

const EMPTY: AdminInput = { name: "", email: "", password: "" };

// Super Admin: create company-owner logins. There's no public signup — the
// owner logs in with these details and registers their company on first login.
export function AdminsView() {
  const admins = useAdminsStore((s) => s.list);
  const loaded = useAdminsStore((s) => s.loaded);
  const load = useAdminsStore((s) => s.load);
  const add = useAdminsStore((s) => s.add);
  const remove = useAdminsStore((s) => s.remove);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AdminInput>({ resolver: zodResolver(adminSchema), defaultValues: EMPTY });
  const password = useWatch({ control, name: "password" });

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(values: AdminInput) {
    if (await add(values)) for (const key of Object.keys(EMPTY) as (keyof AdminInput)[]) setValue(key, "");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admins" description="Company owners' logins. They register their company the first time they log in." className="mb-0" />

      <FormCard title="New admin" crumbs={["Master", "Admins"]} icon={UserCog}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid>
            <FormField label="Full name" htmlFor="ad-name" error={errors.name} required>
              <Input id="ad-name" autoComplete="off" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Email" htmlFor="ad-email" error={errors.email} required>
              <Input id="ad-email" type="email" autoComplete="off" aria-invalid={Boolean(errors.email)} {...register("email")} />
            </FormField>
            <FormField label="Password" htmlFor="ad-password" error={errors.password} required>
              <PasswordInput id="ad-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
            </FormField>
            <FormActions>
              <Button type="submit" disabled={isSubmitting}>
                <Plus /> Create login
              </Button>
            </FormActions>
            {password && <PasswordChecklist password={password} className="col-span-12 xl:col-span-8" />}
          </FormGrid>
          <p className="mt-3 text-xs text-muted-foreground">Share the email and password with the owner. They can change the password after logging in.</p>
        </form>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title={`All admins · ${admins.length}`} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-32">Created</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaded && admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No admins yet — create the first login above.
                </TableCell>
              </TableRow>
            ) : (
              admins.map((a, i) => (
                <TableRow key={a.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{a.companies.length ? a.companies.map((c) => c.name).join(", ") : <span className="text-muted-foreground">Not set up yet</span>}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "default" : "secondary"} className="w-16 justify-center">
                      {a.status === "active" ? "Active" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{fmtDate(a.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {a.status === "pending" && (
                        <ConfirmDelete title={`Remove ${a.name}'s login?`} description="They haven't set up a company yet, so nothing else is affected." onConfirm={() => remove(a.id)} label="Remove" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
