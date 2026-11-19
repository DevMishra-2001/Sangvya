"use client";

// Letter templates: the company's offer, appointment, experience… templates
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Plus } from "lucide-react";
import { AuditCell } from "@/components/common/audit-info";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormHeading } from "@/components/common/form-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { lettersService, type LetterTemplate, type LetterType } from "@/lib/services/letters";

export function TemplatesView() {
  const router = useRouter();
  const [rows, setRows] = useState<LetterTemplate[] | null>(null);
  const [types, setTypes] = useState<{ value: LetterType; label: string }[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    run(lettersService.templates).then((r) => !cancelled && r.ok && setRows(r.data));
    run(lettersService.variables, { silent: true }).then((r) => !cancelled && r.ok && setTypes(r.data.types));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const label = (t: LetterType) => types.find((x) => x.value === t)?.label ?? t;
  const newMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus /> New template
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Start from a ready letter</DropdownMenuLabel>
        {types.map((t) => (
          <DropdownMenuItem key={t.value} onClick={() => router.push(`/letters/templates/new?type=${t.value}`)}>
            <FileText /> {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!rows) return <Skeleton className="h-80 rounded-xl" />;
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <FormHeading title={`Letter templates · ${rows.length}`} icon={FileText} actions={newMenu} />
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No letter templates yet" description="Start from a ready offer, appointment or experience letter, add your letterhead, and save." action={newMenu} />
      ) : (
        <div className="overflow-x-auto">
          <Table className="border-collapse [&_td]:border [&_th]:border">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Letterhead</TableHead>
                <TableHead className="text-center">Version</TableHead>
                <TableHead className="text-center">Letters</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead className="w-20 text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t, i) => (
                <TableRow key={t.id} className={t.is_active ? undefined : "opacity-60"}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/letters/templates/${t.id}`} className="font-medium hover:text-primary hover:underline">
                      {t.name}
                    </Link>
                    <div className="font-mono text-2xs text-muted-foreground">{t.number_prefix}/…</div>
                  </TableCell>
                  <TableCell className="text-xs">{label(t.type)}</TableCell>
                  <TableCell className="text-xs">{t.letterhead_mode === "upload" ? (t.letterhead_name ?? "Uploaded") : t.letterhead_mode === "company" ? "Company letterhead" : <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell className="text-center tabular-nums">v{t.version}</TableCell>
                  <TableCell className="text-center tabular-nums">{t.letters ?? 0}</TableCell>
                  <TableCell>{t.is_active ? <Badge variant="outline" className="border-success/40 text-success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  <TableCell>
                    <AuditCell name={t.created_by_name} at={t.created_at} />
                  </TableCell>
                  <TableCell>
                    <AuditCell name={t.updated_by_name} at={t.updated_by_name ? t.updated_at : null} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon-sm" asChild aria-label={`Edit ${t.name}`}>
                        <Link href={`/letters/templates/${t.id}`}>
                          <Pencil />
                        </Link>
                      </Button>
                      <ConfirmDelete
                        title={`Delete ${t.name}?`}
                        description={(t.letters ?? 0) > 0 ? "Letters were made from it, so it can't be deleted — make it inactive instead." : "This can't be undone."}
                        onConfirm={async () => (await run(() => lettersService.deleteTemplate(t.id), { success: "Template deleted" })).ok && setVersion((v) => v + 1)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
