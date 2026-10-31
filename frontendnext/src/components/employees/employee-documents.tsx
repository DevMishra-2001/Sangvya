"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { FileUpload } from "@/components/common/file-upload";
import { FormField } from "@/components/common/form-field";
import { FormGrid, FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_OPTIONS, JOINING_DOCUMENTS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { employeesService } from "@/lib/services/employees";
import type { DocumentCategory, EmployeeDocument, Id } from "@/lib/types";
import { cn } from "@/lib/utils";

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// An employee's documents: joining checklist, upload (PDF / image / Word, up to 10 MB), open, remove
export function EmployeeDocuments({ employeeId }: { employeeId: Id }) {
  const [docs, setDocs] = useState<EmployeeDocument[] | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("pan_card");
  const [opening, setOpening] = useState<Id | null>(null);

  useEffect(() => {
    let cancelled = false;
    run(() => employeesService.documents(employeeId)).then((r) => !cancelled && setDocs(r.ok ? r.data : []));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const have = new Set((docs ?? []).map((d) => d.category));

  async function openDoc(doc: EmployeeDocument) {
    // Open the tab inside the click so pop-up blockers allow it, then point it at the signed link
    const tab = window.open("", "_blank");
    setOpening(doc.id);
    const result = await run(() => employeesService.documentLink(employeeId, doc.id));
    setOpening(null);
    if (!result.ok) return tab?.close();
    if (tab) {
      tab.opener = null;
      tab.location.href = result.data.url;
    } else window.location.assign(result.data.url);
  }

  async function remove(doc: EmployeeDocument) {
    const result = await run(() => employeesService.removeDocument(employeeId, doc.id), { success: "Document removed" });
    if (result.ok) setDocs((d) => (d ?? []).filter((x) => x.id !== doc.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border bg-card">
        <FormHeading title={`Joining documents · ${JOINING_DOCUMENTS.filter((c) => have.has(c)).length} of ${JOINING_DOCUMENTS.length}`} />
        <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {JOINING_DOCUMENTS.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => setCategory(c)}
                className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary", category === c && "border-primary bg-primary/5")}
              >
                {have.has(c) ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                {DOCUMENT_CATEGORY_LABELS[c]}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card">
        <FormHeading title="Upload a document" />
        <div className="p-4">
          <FormGrid>
            <FormField label="Document type" htmlFor="doc-category">
              <SelectField id="doc-category" value={category} onValueChange={(v) => setCategory(v as DocumentCategory)} options={DOCUMENT_CATEGORY_OPTIONS} />
            </FormField>
            <FormField label="Name (optional)" htmlFor="doc-name">
              <Input id="doc-name" maxLength={150} placeholder={DOCUMENT_CATEGORY_LABELS[category]} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <div className="col-span-12 lg:col-span-6">
              <FileUpload
                accept="document"
                title={`Upload ${DOCUMENT_CATEGORY_LABELS[category]}`}
                upload={async (file, onProgress) => {
                  const doc = await employeesService.uploadDocument(employeeId, file, { name: name.trim() || DOCUMENT_CATEGORY_LABELS[category], category }, onProgress);
                  setDocs((d) => [doc, ...(d ?? [])]);
                  setName("");
                }}
              />
            </div>
          </FormGrid>
          <p className="mt-2 text-xs text-muted-foreground">Files are private — only HR and admins can open them, through a link that works for a few minutes.</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title={`All documents${docs ? ` · ${docs.length}` : ""}`} />
        {!docs ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : docs.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead className="w-48">Type</TableHead>
                <TableHead className="w-24 text-right">Size</TableHead>
                <TableHead className="w-48">Uploaded</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => {
                const Icon = d.mime_type === "application/pdf" || !d.mime_type.startsWith("image/") ? FileText : ImageIcon;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{d.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{d.file_name}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{size(d.size_bytes)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(d.created_at)}
                      <span className="block">{d.uploaded_by_name ?? "By the employee"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openDoc(d)} disabled={opening === d.id} aria-label={`Open ${d.name}`}>
                          {opening === d.id ? <Spinner /> : <ExternalLink />}
                        </Button>
                        <ConfirmDelete title={`Remove “${d.name}”?`} description="The file is deleted for good." onConfirm={() => remove(d)} label="Remove" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
