import { Router, type RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { localDate } from "../../utils/workday.js";
import { idParams } from "../../utils/zod.js";
import { loadBrand } from "../reports/branding.js";
import { toXlsx } from "../reports/exporters/xlsx.js";
import type { ReportResult } from "../reports/types.js";
import { fileUpload } from "../upload/upload.service.js";
import { deleteSetting, listSettings, saveGeneral, saveSetting, ticketMeta } from "./ticketSettings.service.js";
import {
  addComment,
  changeStatus,
  createTicket,
  deleteComment,
  deleteTicket,
  deleteTime,
  exportRows,
  listTickets,
  logTime,
  reassign,
  ticketDetail,
  ticketFile,
  updateTicket,
  uploadTicketFile,
} from "./tickets.service.js";
import {
  assignSchema,
  boardQuery,
  calendarQuery,
  categorySchema,
  commentSchema,
  generalSchema,
  listQuery,
  moduleSchema,
  prioritySchema,
  projectSchema,
  settingParams,
  statusChangeSchema,
  statusSchema,
  ticketSchema,
  timeLogSchema,
  type ListQuery,
  type SettingList,
} from "./tickets.schema.js";
import { board, calendar } from "./ticketViews.service.js";

const router = Router();
router.use(authenticate, scopeToCompany, requirePermission("tasks.assign"));

const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const id = (req: { params: Record<string, string> }) => Number(req.params.id);
const childParams = (key: string) => z.object({ id: z.coerce.number().int().positive(), [key]: z.coerce.number().int().positive() });

// ---- Settings ----
const LIST_BODY: Record<SettingList, z.ZodTypeAny> = { projects: projectSchema, modules: moduleSchema, categories: categorySchema, statuses: statusSchema, priorities: prioritySchema };
const settings = requirePermission("tickets.settings");
// Body rules depend on which list is being saved
const listBody: RequestHandler = (req, res, next) => {
  const schema = LIST_BODY[req.params.list as SettingList];
  return schema ? validate({ body: schema })(req, res, next) : next();
};

router.get("/meta", asyncHandler(async (req, res) => res.json(await ticketMeta(cid(req), currentUser(req)))));
router.get("/settings", settings, asyncHandler(async (req, res) => res.json(await listSettings(cid(req)))));
router.put("/settings/general", settings, validate({ body: generalSchema }), asyncHandler(async (req, res) => res.json({ general: await saveGeneral(cid(req), currentUser(req), req.body) })));
router.post(
  "/settings/:list",
  settings,
  validate({ params: settingParams }),
  listBody,
  asyncHandler(async (req, res) => {
    res.status(HttpStatus.CREATED).json({ row: await saveSetting(cid(req), currentUser(req), req.params.list as SettingList, null, req.body) });
  }),
);
router.put(
  "/settings/:list/:id",
  settings,
  validate({ params: settingParams }),
  listBody,
  asyncHandler(async (req, res) => {
    res.json({ row: await saveSetting(cid(req), currentUser(req), req.params.list as SettingList, id(req), req.body) });
  }),
);
router.delete(
  "/settings/:list/:id",
  settings,
  validate({ params: settingParams }),
  asyncHandler(async (req, res) => {
    await deleteSetting(cid(req), currentUser(req), req.params.list as SettingList, id(req));
    res.json({ success: true });
  }),
);

// ---- Views ----
router.get("/board", validate({ query: boardQuery }), asyncHandler(async (req, res) => res.json(await board(cid(req), currentUser(req), (req.query as { employeeId?: number }).employeeId))));
router.get(
  "/calendar",
  validate({ query: calendarQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { month: string; employeeId?: number };
    res.json(await calendar(cid(req), currentUser(req), q.month, q.employeeId));
  }),
);

// ---- Files: uploaded first, then sent with the ticket ----
router.post("/files", fileUpload.single("file"), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await uploadTicketFile(cid(req), currentUser(req), req.file))));

// ---- List + Excel ----
router.get("/", validate({ query: listQuery }), asyncHandler(async (req, res) => res.json(await listTickets(cid(req), currentUser(req), req.query as unknown as ListQuery))));
router.get(
  "/export",
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const rows = await exportRows(cid(req), currentUser(req), req.query as unknown as ListQuery);
    const day = (d: Date | string | null) => (d ? localDate(new Date(d)) : null);
    const report: ReportResult = {
      title: "Tickets",
      subtitle: `${rows.length} ticket${rows.length === 1 ? "" : "s"}`,
      columns: [
        { key: "code", label: "Ticket", type: "code", width: 12 },
        { key: "title", label: "Title", width: 40 },
        { key: "project", label: "Project", width: 20 },
        { key: "category", label: "Category", width: 14 },
        { key: "priority", label: "Priority", width: 10 },
        { key: "status", label: "Status", width: 13 },
        { key: "assigned_to", label: "Assigned to", width: 20 },
        { key: "secondary", label: "Secondary", width: 18 },
        { key: "reported_by", label: "Reported by", width: 18 },
        { key: "due_date", label: "Delivery date", type: "date", width: 12 },
        { key: "delayed", label: "Delayed", width: 8 },
        { key: "spent", label: "Hours spent", type: "number", width: 10 },
        { key: "created_on", label: "Created on", type: "date", width: 12 },
        { key: "created_by", label: "Created by", width: 18 },
        { key: "updated_on", label: "Updated on", type: "date", width: 12 },
        { key: "updated_by", label: "Updated by", width: 18 },
      ],
      rows: rows.map((r) => ({
        code: r.code,
        title: r.title,
        project: r.project_name ?? "",
        category: r.category_name ?? "",
        priority: r.priority_name ?? "",
        status: r.status_name,
        assigned_to: r.assigned_to_name ?? "",
        secondary: r.secondary_name ?? "",
        reported_by: r.reported_by_name ?? "",
        due_date: r.due_date,
        delayed: r.delayed ? "Yes" : "",
        spent: Math.round((r.spent_minutes / 60) * 100) / 100,
        created_on: day(r.created_at),
        created_by: r.created_by_name ?? "",
        updated_on: day(r.updated_at),
        updated_by: r.updated_by_name ?? "",
      })),
      fileName: "tickets",
      landscape: true,
    };
    const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, currentUser(req).id));
    const body = await toXlsx(report, { company: (await loadBrand(cid(req))).company.name, printedBy: me?.name });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="tickets.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  }),
);

// ---- One ticket ----
router.post("/", validate({ body: ticketSchema }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createTicket(cid(req), currentUser(req), req.body))));
router.get("/:id", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await ticketDetail(cid(req), currentUser(req), id(req)))));
router.put("/:id", validate({ params: idParams, body: ticketSchema }), asyncHandler(async (req, res) => res.json(await updateTicket(cid(req), currentUser(req), id(req), req.body))));
router.delete(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await deleteTicket(cid(req), currentUser(req), id(req));
    res.json({ success: true });
  }),
);
router.post("/:id/status", validate({ params: idParams, body: statusChangeSchema }), asyncHandler(async (req, res) => res.json(await changeStatus(cid(req), currentUser(req), id(req), req.body.statusId, req.body.note))));
router.post("/:id/assign", validate({ params: idParams, body: assignSchema }), asyncHandler(async (req, res) => res.json(await reassign(cid(req), currentUser(req), id(req), req.body))));
router.post("/:id/comments", validate({ params: idParams, body: commentSchema }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await addComment(cid(req), currentUser(req), id(req), req.body.body))));
router.delete(
  "/:id/comments/:commentId",
  validate({ params: childParams("commentId") }),
  asyncHandler(async (req, res) => {
    await deleteComment(cid(req), currentUser(req), id(req), Number(req.params.commentId));
    res.json({ success: true });
  }),
);
router.post("/:id/time", validate({ params: idParams, body: timeLogSchema }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await logTime(cid(req), currentUser(req), id(req), req.body))));
router.delete(
  "/:id/time/:logId",
  validate({ params: childParams("logId") }),
  asyncHandler(async (req, res) => {
    await deleteTime(cid(req), currentUser(req), id(req), Number(req.params.logId));
    res.json({ success: true });
  }),
);
router.get(
  "/:id/files/:index",
  validate({ params: z.object({ id: z.coerce.number().int().positive(), index: z.coerce.number().int().min(0).max(20) }) }),
  asyncHandler(async (req, res) => res.json(await ticketFile(cid(req), currentUser(req), id(req), Number(req.params.index)))),
);

export const ticketRoutes = router;
