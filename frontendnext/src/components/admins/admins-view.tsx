"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, RotateCw, UserCog } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { DevLinkBanner } from "@/components/common/dev-link-banner";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import { adminSchema, type AdminForm, type AdminInput } from "@/lib/schemas/admin";
import type { AdminRow } from "@/lib/types";
import { useAdminsStore } from "@/stores/admins-store";

const EMPTY: AdminForm = { name: "", email: "", companyName: "" };

const STATUS: Record<AdminRow["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  invited: { label: "Invited", variant: "secondary" },
  expired: { label: "Link expired", variant: "destructive" },
  setup: { label: "Setting up", variant: "outline" },
  active: { label: "Active", variant: "default" },
};

// Super Admin: invite company owners. They get an activation link by email, set
// their own password and register their company. (Outside production the API
// also returns the link — shown below — so it can be tested without email.)
export function AdminsView() {
  const admins = useAdminsStore((s) => s.list);
  const loaded = useAdminsStore((s) => s.loaded);
  const devLink = useAdminsStore((s) => s.devLink);
  const load = useAdminsStore((s) => s.load);
  const invite = useAdminsStore((s) => s.invite);
  const resend = useAdminsStore((s) => s.resend);
  const remove = useAdminsStore((s) => s.remove);
  const clearDevLink = useAdminsStore((s) => s.clearDevLink);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AdminForm, unknown, AdminInput>({ resolver: zodResolver(adminSchema), defaultValues: EMPTY });

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(values: AdminInput) {
    if (await invite(values)) for (const key of Object.keys(EMPTY) as (keyof AdminForm)[]) setValue(key, "");
  }


  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admins" description="Invite company owners. They set their own password from the emailed link, then register their company." className="mb-0" />

      <FormCard title="Invite admin" crumbs={["Master", "Admins"]} icon={UserCog}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid>
            <FormField label="Full name" htmlFor="ad-name" error={errors.name} required>
              <Input id="ad-name" autoComplete="off" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Work email" htmlFor="ad-email" error={errors.email} required>
              <Input id="ad-email" type="email" autoComplete="off" aria-invalid={Boolean(errors.email)} {...register("email")} />
            </FormField>
            <FormField label="Company name" htmlFor="ad-company" error={errors.companyName}>
              <Input id="ad-company" autoComplete="off" placeholder="Optional — pre-fills their setup" {...register("companyName")} />
            </FormField>
            <FormActions>
              <Button type="submit" disabled={isSubmitting}>
                <Mail /> Send invitation
              </Button>
            </FormActions>
          </FormGrid>
          <p className="mt-3 text-xs text-muted-foreground">The link works once. Nobody else sees or sets their password.</p>
        </form>
      </FormCard>

      {devLink && <DevLinkBanner devLink={devLink} onClose={clearDevLink} />}

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title={`All admins · ${admins.length}`} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-32">Invited</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaded && admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No admins yet — send the first invitation above.
                </TableCell>
              </TableRow>
            ) : (
              admins.map((a, i) => {
                const pending = a.status === "invited" || a.status === "expired";
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.email}</TableCell>
                    <TableCell>{a.companies.length ? a.companies.map((c) => c.name).join(", ") : <span className="text-muted-foreground">Not set up yet</span>}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS[a.status].variant} title={a.status === "invited" && a.invite_expires_at ? `Link valid until ${new Date(a.invite_expires_at).toLocaleString("en-IN")}` : undefined}>
                        {STATUS[a.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{fmtDate(a.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {pending && (
                          <Button variant="ghost" size="icon-sm" onClick={() => resend(a)} aria-label={`Resend invitation to ${a.name}`} title="Resend invitation">
                            <RotateCw />
                          </Button>
                        )}
                        {!a.companies.length && (
                          <ConfirmDelete
                            title={`Remove ${a.name}?`}
                            description={pending ? "Their activation link stops working." : "They haven't set up a company yet, so nothing else is affected."}
                            onConfirm={() => remove(a.id)}
                            label="Remove"
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
