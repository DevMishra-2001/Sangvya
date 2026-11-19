"use client";

// HR Letters: every letter made in the company — search, filter, open
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Mail, Search } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormCard, FormGrid } from "@/components/common/form-layout";
import { Pagination } from "@/components/common/pagination";
import { SelectField } from "@/components/common/select-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDateTime } from "@/lib/format";
import { lettersService, type LetterType } from "@/lib/services/letters";

type Data = Awaited<ReturnType<typeof lettersService.register>>;

export function LettersRegisterView() {
  const url = useUrlParams();
  const applied = { type: url.get("type") || undefined, status: url.get("status") || undefined, q: url.get("q") || undefined, page: url.getNumber("page", 1), limit: url.getNumber("limit", 20) };
  const key = JSON.stringify(applied);
  const [q, setQ] = useState(applied.q ?? "");
  const [data, setData] = useState<Data | null>(null);
  const [types, setTypes] = useState<{ value: LetterType; label: string }[]>([]);

  useEffect(() => {
    run(lettersService.variables, { silent: true }).then((r) => r.ok && setTypes(r.data.types));
  }, []);
  useEffect(() => {
    let cancelled = false;
    run(() => lettersService.register(JSON.parse(key))).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const label = (t: string) => types.find((x) => x.value === t)?.label ?? t;
  return (
    <div className="flex flex-col gap-4">
      <FormCard
        title="HR Letters"
        icon={Mail}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/letters/templates">Templates</Link>
          </Button>
        }
      >
        <FormGrid>
          <FormField label="Letter type" htmlFor="lr-type">
            <SelectField id="lr-type" value={applied.type ?? ""} onValueChange={(v) => url.set({ type: v || null, page: null })} emptyLabel="All" options={types.map((t) => ({ value: t.value, label: t.label }))} />
          </FormField>
          <FormField label="Status" htmlFor="lr-status">
            <SelectField
              id="lr-status"
              value={applied.status ?? ""}
              onValueChange={(v) => url.set({ status: v || null, page: null })}
              emptyLabel="All"
              options={[
                { value: "issued", label: "Issued" },
                { value: "draft", label: "Draft" },
              ]}
            />
          </FormField>
          <FormField label="Employee / letter no." htmlFor="lr-q">
            <Input id="lr-q" data-page-search value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url.set({ q: q || null, page: null })} />
          </FormField>
          <div className="col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-2 [&_[data-slot=button]]:h-9">
            <Button onClick={() => url.set({ q: q || null, page: null })}>
              <Search /> Search
            </Button>
          </div>
        </FormGrid>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        {!data ? (
          <Skeleton className="m-3 h-48" />
        ) : data.rows.length === 0 ? (
          <EmptyState icon={Mail} title="No letters yet" description="Open an employee's profile and use Generate letter." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="border-collapse [&_td]:border [&_th]:border">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Letter no.</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Letter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="w-16 text-center">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs text-primary">{l.code ?? "—"}</TableCell>
                    <TableCell>
                      <Link href={`/employees/${l.employee_id}`} className="font-medium hover:text-primary hover:underline">
                        {l.employee_name}
                      </Link>
                      {l.employee_code && <div className="text-2xs text-muted-foreground">{l.employee_code}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.title}
                      <div className="text-2xs text-muted-foreground">{label(l.type)} · template v{l.version}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={l.status === "issued" ? "success" : "warning"} className="normal-case">
                        {l.status === "issued" ? "Issued" : "Draft"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs">{l.issued_at ? `${fmtDateTime(l.issued_at)} · ${l.issued_by_name ?? "—"}` : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {l.created_by_name ?? "—"}
                      <div className="text-2xs text-muted-foreground">{fmtDateTime(l.created_at)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon-sm" aria-label={`Open ${l.title}`} onClick={() => run(() => lettersService.openPdf(l.id))}>
                        <Eye />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.total > 0 && <Pagination className="border-t px-3 py-2" page={data.page} limit={data.limit} total={data.total} onPageChange={(p) => url.set({ page: p === 1 ? null : p })} onLimitChange={(l) => url.set({ limit: l === 20 ? null : l, page: null })} />}
      </section>
    </div>
  );
}

// My Letters: an employee's own issued letters
export function MyLettersView() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof lettersService.mine>> | null>(null);
  useEffect(() => {
    run(lettersService.mine).then((r) => r.ok && setRows(r.data));
  }, []);
  if (!rows) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-primary/8 px-3 py-1.5 text-[13px] font-semibold">My letters · {rows.length}</div>
      {rows.length === 0 ? (
        <EmptyState icon={Mail} title="No letters yet" description="Letters HR issues to you (offer, appointment, experience…) show up here." />
      ) : (
        <ul className="divide-y">
          {rows.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <Mail className="size-4 text-muted-foreground" />
              <span className="font-medium">{l.title}</span>
              <span className="font-mono text-xs text-primary">{l.code}</span>
              <span className="text-xs text-muted-foreground">{fmtDateTime(l.issued_at)}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => run(() => lettersService.openMine(l.id))}>
                <Eye /> Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
