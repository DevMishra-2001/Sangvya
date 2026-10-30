"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, Image as ImageIcon, Upload } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormGrid, FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_OPTIONS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { employeesService } from "@/lib/services/employees";
import type { DocumentCategory, EmployeeDocument, Id } from "@/lib/types";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024; // keep in sync with the backend
const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// An employee's documents: upload (PDF / image, up to 10 MB), open, remove.
export function EmployeeDocuments({ employeeId }: { employeeId: Id }) {
  const [docs, setDocs] = useState<EmployeeDocument[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("id_proof");
  const [fileError, setFileError] = useState<string | undefined>();
  const [progress, setProgress] = useState<number | null>(null);
  const [opening, setOpening] = useState<Id | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    run(() => employeesService.documents(employeeId)).then((r) => setDocs(r.ok ? r.data : []));
  }, [employeeId]);

  function pick(f: File | null) {
    setFileError(undefined);
    if (f && !ACCEPT.split(",").includes(f.type)) {
      setFileError("Upload a PDF or an image (JPEG, PNG, WebP)");
      f = null;
    } else if (f && f.size > MAX_BYTES) {
      setFileError("The file is larger than 10 MB");
      f = null;
    }
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^/.]+$/, ""));
  }

  async function upload() {
    if (!file) {
      setFileError("Choose a file");
      return;
    }
    setProgress(0);
    const result = await run(() => employeesService.uploadDocument(employeeId, file, { name, category }, setProgress), { success: "Document uploaded" });
    setProgress(null);
    if (!result.ok) return;
    setDocs((d) => [result.data, ...(d ?? [])]);
    setFile(null);
    setName("");
    if (input.current) input.current.value = "";
  }

  async function openDoc(doc: EmployeeDocument) {
    // Open the tab now (inside the click) so pop-up blockers allow it, then point it at the link
    const tab = window.open("", "_blank");
    setOpening(doc.id);
    const result = await run(() => employeesService.documentLink(employeeId, doc.id));
    setOpening(null);
    if (!result.ok) {
      tab?.close();
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = result.data.url;
    } else {
      window.location.assign(result.data.url); // pop-ups blocked: open it here
    }
  }

  async function remove(doc: EmployeeDocument) {
    const result = await run(() => employeesService.removeDocument(employeeId, doc.id), { success: "Document removed" });
    if (result.ok) setDocs((d) => (d ?? []).filter((x) => x.id !== doc.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border bg-card">
        <FormHeading title="Upload a document" />
        <div className="p-4">
          <FormGrid>
            <FormField label="File" htmlFor="doc-file" error={fileError ? { message: fileError } : undefined} float={false} span="md">
              <Input id="doc-file" ref={input} type="file" accept={ACCEPT} onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-invalid={Boolean(fileError)} />
            </FormField>
            <FormField label="Category" htmlFor="doc-category">
              <SelectField id="doc-category" value={category} onValueChange={(v) => setCategory(v as DocumentCategory)} options={DOCUMENT_CATEGORY_OPTIONS} />
            </FormField>
            <FormField label="Name" htmlFor="doc-name">
              <Input id="doc-name" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aadhaar card" />
            </FormField>
            <FormActions>
              <Button type="button" onClick={upload} disabled={progress !== null}>
                {progress !== null ? <Spinner /> : <Upload />} Upload
              </Button>
            </FormActions>
          </FormGrid>
          {progress !== null && <Progress value={progress} className="mt-3 h-1.5" aria-label="Upload progress" />}
          <p className="mt-2 text-xs text-muted-foreground">PDF or image, up to 10 MB. Files are private — only HR and admins can open them.</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title={`Documents${docs ? ` · ${docs.length}` : ""}`} />
        {docs === null ? (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        ) : docs.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead className="w-36">Category</TableHead>
                <TableHead className="w-24 text-right">Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => {
                const Icon = d.mime_type === "application/pdf" ? FileText : ImageIcon;
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
                      <Badge variant="secondary">{DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{size(d.size_bytes)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(d.created_at)}
                      {d.uploaded_by_name && ` · ${d.uploaded_by_name}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openDoc(d)} disabled={opening === d.id} aria-label={`Open ${d.name}`} title="Open">
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
