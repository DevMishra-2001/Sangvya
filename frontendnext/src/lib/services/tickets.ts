import { api } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import type { Id } from "@/lib/types";

export type StatusKind = "open" | "active" | "hold" | "review" | "done" | "closed";
export interface Attachment {
  path: string;
  name: string;
}

// Who added / last changed a row
export interface AuditFields {
  created_at: string | null;
  created_by: Id | null;
  created_by_name?: string | null;
  updated_at: string | null;
  updated_by: Id | null;
  updated_by_name?: string | null;
}

// ---- Settings ----

export interface TicketProject extends AuditFields {
  id: Id;
  name: string;
  code: string | null;
  client_name: string | null;
  version: string | null;
  description: string | null;
  default_assignee_id: Id | null;
  default_assignee_name?: string | null;
  is_active: boolean;
  sort_order: number;
  tickets?: number;
  modules?: number;
}
export interface TicketModule extends AuditFields {
  id: Id;
  project_id: Id;
  project_name?: string;
  name: string;
  is_active: boolean;
  tickets?: number;
}
export interface TicketCategory extends AuditFields {
  id: Id;
  name: string;
  color: string;
  default_days: number | null;
  is_active: boolean;
  sort_order: number;
  tickets?: number;
}
export interface TicketStatus extends AuditFields {
  id: Id;
  name: string;
  color: string;
  kind: StatusKind;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  tickets?: number;
}
export interface TicketPriority extends AuditFields {
  id: Id;
  name: string;
  color: string;
  sla_hours: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  tickets?: number;
}
export interface TicketGeneral extends AuditFields {
  company_id: Id;
  prefix: string;
  number_digits: number;
  next_number: number;
  who_can_create: "everyone" | "managers";
  assign_anyone: boolean;
  allow_self_assign: boolean;
  require_project: boolean;
  require_time_on_done: boolean;
  auto_close_days: number | null;
  notify_on_assign: boolean;
}
export interface TicketSettingsData {
  general: TicketGeneral;
  projects: TicketProject[];
  modules: TicketModule[];
  categories: TicketCategory[];
  statuses: TicketStatus[];
  priorities: TicketPriority[];
}
export type SettingList = "projects" | "modules" | "categories" | "statuses" | "priorities";

export interface TicketPerson {
  id: Id;
  name: string;
  code: string | null;
  photo_url?: string | null;
  manager_id?: Id | null;
}

export interface TicketMeta {
  settings: TicketGeneral;
  projects: Pick<TicketProject, "id" | "name" | "code" | "version" | "client_name" | "default_assignee_id" | "is_active">[];
  modules: Pick<TicketModule, "id" | "project_id" | "name" | "is_active">[];
  categories: Pick<TicketCategory, "id" | "name" | "color" | "default_days" | "is_active">[];
  statuses: Pick<TicketStatus, "id" | "name" | "color" | "kind" | "is_default" | "is_active">[];
  priorities: Pick<TicketPriority, "id" | "name" | "color" | "sla_hours" | "is_default" | "is_active">[];
  people: TicketPerson[];
  me: { employeeId: Id | null; userId: Id };
  can: { seeAll: boolean; seeTeam: boolean; settings: boolean; create: boolean };
}

// ---- Tickets ----

export interface TicketRow extends AuditFields {
  id: Id;
  number: number;
  code: string;
  title: string;
  project_id: Id | null;
  project_name: string | null;
  module_id: Id | null;
  module_name: string | null;
  category_id: Id | null;
  category_name: string | null;
  category_color: string | null;
  priority_id: Id | null;
  priority_name: string | null;
  priority_color: string | null;
  status_id: Id;
  status_name: string;
  status_color: string;
  status_kind: StatusKind;
  assigned_to: Id | null;
  assigned_to_name: string | null;
  assigned_to_photo: string | null;
  secondary_assignee: Id | null;
  secondary_name: string | null;
  reported_by_name: string | null;
  reported_by_mobile: string | null;
  page_url: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  spent_minutes: number;
  started_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  delayed: boolean;
}
export interface Ticket extends TicketRow {
  description: string | null;
  attachments: Attachment[];
}
export interface TicketComment extends AuditFields {
  id: Id;
  body: string;
}
export interface TicketEvent {
  id: Id;
  kind: string;
  text: string;
  created_at: string;
  created_by_name: string | null;
}
export interface TicketTime extends AuditFields {
  id: Id;
  employee_id: Id;
  employee_name: string;
  work_date: string;
  minutes: number;
  note: string | null;
}
export interface TicketDetail {
  ticket: Ticket;
  comments: TicketComment[];
  events: TicketEvent[];
  time: TicketTime[];
  can: { edit: boolean; assign: boolean; log: boolean; delete: boolean };
}

export interface TicketFilters {
  scope?: "mine" | "created" | "team" | "all";
  q?: string;
  projectId?: string;
  categoryId?: string;
  statusId?: string;
  priorityId?: string;
  assignedTo?: string;
  departmentId?: number;
  view?: "open" | "finished" | "delayed" | "all";
  createdFrom?: string;
  createdTo?: string;
  dueFrom?: string;
  dueTo?: string;
  sort?: "created" | "due" | "updated" | "code";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}
export interface TicketList {
  rows: TicketRow[];
  total: number;
  delayed: number;
  spentMinutes: number;
  statusCounts: Record<string, number>;
  page: number;
  limit: number;
}

export interface TicketBody {
  title: string;
  description?: string | null;
  projectId?: Id | null;
  moduleId?: Id | null;
  categoryId?: Id | null;
  priorityId?: Id | null;
  statusId?: Id | null;
  assignedTo?: Id | null;
  secondaryAssignee?: Id | null;
  reportedByName?: string | null;
  reportedByMobile?: string | null;
  pageUrl?: string | null;
  dueDate?: string | null;
  estimateMinutes?: number | null;
  attachments?: Attachment[];
}

export interface BoardData {
  employee: { id: Id; name: string };
  statuses: Pick<TicketStatus, "id" | "name" | "color" | "kind">[];
  tickets: TicketRow[];
  people: TicketPerson[];
  counts: { delayed: number; dueToday: number; onTime: number };
}

export type CalendarTicket = Pick<TicketRow, "id" | "code" | "title" | "due_date" | "status_id" | "status_name" | "status_color" | "status_kind" | "project_name" | "priority_name" | "priority_color" | "delayed">;
export interface CalendarData {
  employee: { id: Id; name: string };
  month: string;
  tiles: { workingDays: number; totalMinutes: number; daysWorked: number; avgMinutesPerDay: number };
  days: { date: string; due: CalendarTicket[]; worked: (CalendarTicket & { minutes: number; note: string | null })[]; minutes: number }[];
  projects: { project_id: Id | null; project_name: string; open: number; active: number; hold: number; review: number; done: number; delayed: number; total: number }[];
  people: TicketPerson[];
}

type Params = Record<string, string | number | undefined>;

export const ticketsService = {
  meta: async () => (await api.get<TicketMeta>("/tickets/meta")).data,
  settings: async () => (await api.get<TicketSettingsData>("/tickets/settings")).data,
  saveSetting: async (list: SettingList, id: Id | null, body: Record<string, unknown>) =>
    (id ? await api.put<{ row: unknown }>(`/tickets/settings/${list}/${id}`, body) : await api.post<{ row: unknown }>(`/tickets/settings/${list}`, body)).data.row,
  deleteSetting: async (list: SettingList, id: Id) => {
    await api.delete(`/tickets/settings/${list}/${id}`);
  },
  saveGeneral: async (body: Record<string, unknown>) => (await api.put<{ general: TicketGeneral }>("/tickets/settings/general", body)).data.general,

  list: async (params: TicketFilters) => (await api.get<TicketList>("/tickets", { params })).data,
  exportExcel: (params: TicketFilters) => downloadFile("/tickets/export", params as Params, "tickets.xlsx"),
  get: async (id: Id) => (await api.get<TicketDetail>(`/tickets/${id}`)).data,
  create: async (body: TicketBody) => (await api.post<{ ticket: { id: Id; code: string } }>("/tickets", body)).data.ticket,
  update: async (id: Id, body: TicketBody) => (await api.put<{ ticket: { id: Id; code: string }; changed: number }>(`/tickets/${id}`, body)).data,
  remove: async (id: Id) => {
    await api.delete(`/tickets/${id}`);
  },
  setStatus: async (id: Id, statusId: Id, note?: string) => (await api.post(`/tickets/${id}/status`, { statusId, note })).data,
  assign: async (id: Id, body: { assignedTo: Id | null; secondaryAssignee: Id | null; note?: string }) => (await api.post(`/tickets/${id}/assign`, body)).data,
  comment: async (id: Id, body: string) => (await api.post(`/tickets/${id}/comments`, { body })).data,
  deleteComment: async (id: Id, commentId: Id) => {
    await api.delete(`/tickets/${id}/comments/${commentId}`);
  },
  logTime: async (id: Id, body: { workDate: string; minutes: number; note?: string }) => (await api.post(`/tickets/${id}/time`, body)).data,
  deleteTime: async (id: Id, logId: Id) => {
    await api.delete(`/tickets/${id}/time/${logId}`);
  },
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post<{ file: Attachment }>("/tickets/files", form)).data.file;
  },
  file: async (id: Id, index: number) => (await api.get<{ url: string }>(`/tickets/${id}/files/${index}`)).data.url,
  board: async (employeeId?: Id) => (await api.get<BoardData>("/tickets/board", { params: { employeeId } })).data,
  calendar: async (month: string, employeeId?: Id) => (await api.get<CalendarData>("/tickets/calendar", { params: { month, employeeId } })).data,
};
