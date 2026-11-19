import { api } from "@/lib/api/client";
import { openFile } from "@/lib/download";
import type { AuditNames, Id } from "@/lib/types";

export type LetterType = "offer" | "appointment" | "probation_confirmation" | "probation_extension" | "experience" | "relieving" | "increment" | "warning" | "noc" | "custom";

// TipTap / ProseMirror JSON
export type LetterDoc = { type: string; attrs?: Record<string, unknown>; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: LetterDoc[] };

export interface LetterField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "number";
  required: boolean;
}

export type LetterheadMode = "company" | "upload" | "none";

// The company letterhead (from the company profile), drawn on every page
export interface CompanyLetterhead {
  name: string;
  lines: string[];
  logoUrl: string | null;
}

export interface LetterCatalog {
  variables: VariableDef[];
  types: { value: LetterType; label: string; prefix: string }[];
  letterhead: CompanyLetterhead;
}

export interface VariableDef {
  key: string;
  label: string;
  group: string;
  block?: boolean;
}

export interface LetterTemplate extends AuditNames {
  id: Id;
  type: LetterType;
  name: string;
  title: string | null;
  letterhead_mode: LetterheadMode;
  page_numbers: boolean;
  letterhead_path: string | null;
  letterhead_name: string | null;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  body: LetterDoc;
  fields: LetterField[];
  signatory_name: string | null;
  signatory_title: string | null;
  signature_path: string | null;
  number_prefix: string;
  version: number;
  is_active: boolean;
  letters?: number;
}

export interface TemplateBody {
  type: LetterType;
  name: string;
  title: string | null;
  letterheadMode: LetterheadMode;
  pageNumbers: boolean;
  letterheadPath: string | null;
  letterheadName: string | null;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  body: LetterDoc;
  fields: LetterField[];
  signatoryName: string | null;
  signatoryTitle: string | null;
  signaturePath: string | null;
  numberPrefix: string;
  isActive: boolean;
}

export interface EmployeeLetter extends AuditNames {
  id: Id;
  employee_id: Id;
  employee_name: string;
  employee_code: string | null;
  template_id: Id | null;
  type: LetterType;
  title: string;
  code: string | null;
  status: "draft" | "issued";
  values?: Record<string, string>;
  issued_at: string | null;
  issued_by_name: string | null;
  version: number;
}

export interface LetterSuggestion {
  type: LetterType;
  reason: string;
  label: string;
  template: { id: Id; name: string; type: LetterType };
}

export interface LetterForm {
  template: { id: Id; name: string; type: LetterType; title: string; version: number };
  auto: { key: string; label: string; value: string }[];
  fields: LetterField[];
  missing: string[];
}

export interface LetterBody {
  templateId: Id;
  values: Record<string, string>;
  issue: boolean;
}

// A PDF from a POST (preview) as an object URL for an <iframe>
async function pdfUrl(path: string, body: unknown) {
  const res = await api.post<Blob>(path, body, { responseType: "blob" });
  return URL.createObjectURL(res.data);
}

export const lettersService = {
  variables: async () => (await api.get<LetterCatalog>("/letters/variables")).data,
  // Page 1 of an uploaded letterhead as an image URL (the editor's page background)
  letterheadImage: async (path: string) => URL.createObjectURL((await api.get<Blob>("/letters/templates/letterhead", { params: { path }, responseType: "blob" })).data),
  templates: async () => (await api.get<{ templates: LetterTemplate[] }>("/letters/templates")).data.templates,
  template: async (id: Id) => (await api.get<{ template: LetterTemplate }>(`/letters/templates/${id}`)).data.template,
  starter: async (type: LetterType) => (await api.get<{ body: LetterDoc; fields: LetterField[]; title: string; numberPrefix: string }>("/letters/templates/starter", { params: { type } })).data,
  saveTemplate: async (id: Id | null, body: TemplateBody) => (id ? await api.put<{ template: LetterTemplate }>(`/letters/templates/${id}`, body) : await api.post<{ template: LetterTemplate }>("/letters/templates", body)).data.template,
  deleteTemplate: async (id: Id) => {
    await api.delete(`/letters/templates/${id}`);
  },
  previewTemplate: (template: TemplateBody, employeeId?: Id) => pdfUrl("/letters/templates/preview", { template, employeeId }),
  upload: async (kind: "letterhead" | "signature", file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post<{ file: { path: string; name: string } }>("/letters/files", form, { params: { kind } })).data.file;
  },

  forEmployee: async (employeeId: Id) =>
    (await api.get<{ letters: EmployeeLetter[]; templates: { id: Id; name: string; type: LetterType }[]; suggestions: LetterSuggestion[] }>(`/letters/employees/${employeeId}`)).data,
  form: async (employeeId: Id, templateId: Id) => (await api.get<LetterForm>(`/letters/employees/${employeeId}/form`, { params: { templateId } })).data,
  previewLetter: (employeeId: Id, body: LetterBody) => pdfUrl(`/letters/employees/${employeeId}/preview`, body),
  save: async (employeeId: Id, letterId: Id | null, body: LetterBody) =>
    (letterId ? await api.put<{ letter: { id: Id; status: string; code?: string } }>(`/letters/employees/${employeeId}/${letterId}`, body) : await api.post<{ letter: { id: Id; status: string; code?: string } }>(`/letters/employees/${employeeId}`, body)).data.letter,
  remove: async (id: Id) => {
    await api.delete(`/letters/${id}`);
  },
  openPdf: (id: Id) => openFile(`/letters/${id}/pdf`, undefined, "letter.pdf"),

  register: async (params: { type?: string; status?: string; q?: string; page?: number; limit?: number }) =>
    (await api.get<{ rows: EmployeeLetter[]; total: number; page: number; limit: number }>("/letters", { params })).data,

  mine: async () => (await api.get<{ letters: EmployeeLetter[] }>("/letters/mine")).data.letters,
  openMine: (id: Id) => openFile(`/letters/mine/${id}/pdf`, undefined, "letter.pdf"),
};
