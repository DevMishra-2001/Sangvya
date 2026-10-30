"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { platformService, type AuditFilters } from "@/lib/services/platform-companies";
import type { AuditEntry, Id } from "@/lib/types";
import { usePlatformCompaniesStore } from "@/stores/platform-companies-store";
import { AUDIT_GROUPS, AuditActionBadge } from "./audit-action-badge";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Super Admin: who did what, when, and in which company — newest first
export function AuditLogView() {
  const companies = usePlatformCompaniesStore((s) => s.list);
  const loadCompanies = usePlatformCompaniesStore((s) => s.load);
  const [action, setAction] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // search, applied after typing stops
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<Id | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo<AuditFilters>(() => ({ action: action || undefined, companyId: companyId ? Number(companyId) : undefined, q: q || undefined }), [action, companyId, q]);

  const fetchPage = useCallback(
    async (before?: Id) => {
      setLoading(true);
      setError(null);
      try {
        const data = await platformService.audit({ ...filters, before });
        setEntries((prev) => (before ? [...prev, ...data.entries] : data.entries));
        setCursor(data.nextCursor);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the first page whenever the filters change
    fetchPage();
  }, [fetchPage]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit log" description="Major actions across the platform — invitations, verification, suspensions, modules, roles and logins." className="mb-0" />

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading
          title="Activity"
          actions={
            <>
              <Input placeholder="Search summary or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-56" aria-label="Search the audit log" />
              <SelectField size="sm" className="w-40" value={action} onValueChange={setAction} emptyLabel="All actions" options={AUDIT_GROUPS} aria-label="Filter by action" />
              <SelectField
                size="sm"
                className="w-44"
                value={companyId}
                onValueChange={setCompanyId}
                emptyLabel="All companies"
                options={companies.map((c) => ({ value: String(c.id), label: c.name }))}
                aria-label="Filter by company"
              />
            </>
          }
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead className="w-48">Action</TableHead>
              <TableHead>What happened</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Company</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : !loading && entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {filters.action || filters.companyId || filters.q ? "Nothing matches these filters." : "Nothing recorded yet."}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{when(e.created_at)}</TableCell>
                  <TableCell>
                    <AuditActionBadge action={e.action} />
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">{e.summary}</TableCell>
                  <TableCell className="text-muted-foreground">{e.actor_email ?? "System"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.company_name ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {(loading || cursor) && (
          <div className="flex justify-center border-t p-3">
            {loading ? (
              <Spinner />
            ) : (
              <Button variant="outline" size="sm" onClick={() => fetchPage(cursor!)}>
                Load more
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
