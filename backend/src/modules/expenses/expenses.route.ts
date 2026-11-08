import { Router } from "express";
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
import { idParams } from "../../utils/zod.js";
import { loadBrand } from "../reports/branding.js";
import { toXlsx } from "../reports/exporters/xlsx.js";
import type { ReportResult } from "../reports/types.js";
import { fileUpload } from "../upload/upload.service.js";
import { advanceSchema, balanceQuery, claimSchema, decisionSchema, listQuery, paySchema, type ListQuery } from "./expenses.schema.js";
import { expenseVoucherPdf } from "./expenseVoucher.js";
import {
  advanceDetail,
  advanceFile,
  balance,
  cancelAdvance,
  claimDetail,
  claimFile,
  createAdvance,
  decideAdvance,
  decideClaim,
  deleteClaim,
  listExpenses,
  myBank,
  payAdvance,
  payClaim,
  saveClaim,
  teamMembers,
  uploadBill,
} from "./expenses.service.js";

const router = Router();
router.use(authenticate, scopeToCompany, requirePermission("expense.self"));

const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const id = (req: { params: Record<string, string> }) => Number(req.params.id);
const files = z.object({ attachments: z.array(z.object({ path: z.string().max(500), name: z.string().max(255) })).max(10).optional() });
const fileParams = z.object({ id: z.coerce.number().int().positive(), index: z.coerce.number().int().min(0).max(20) });

// Bills: uploaded first, then sent with the advance / claim
router.post("/files", fileUpload.single("file"), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await uploadBill(cid(req), currentUser(req), req.file))));
router.get("/bank", asyncHandler(async (req, res) => res.json(currentUser(req).employeeId ? await myBank(cid(req), currentUser(req).employeeId!) : { bank: null })));
router.get("/balance", validate({ query: balanceQuery }), asyncHandler(async (req, res) => res.json(await balance(cid(req), currentUser(req), (req.query as { employeeId?: number }).employeeId, (req.query as { month?: string }).month))));
router.get("/people", asyncHandler(async (req, res) => res.json(await teamMembers(cid(req), currentUser(req)))));

// ---- List (View Expense) + Excel ----
router.get(
  "/",
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { all: _all, ...rest } = await listExpenses(cid(req), currentUser(req), req.query as unknown as ListQuery);
    res.json(rest);
  }),
);
router.get(
  "/export",
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const data = await listExpenses(cid(req), currentUser(req), { ...(req.query as unknown as ListQuery), page: 1, limit: 100 });
    const q = req.query as unknown as ListQuery;
    const money = (key: string, label: string) => ({ key, label, type: "money" as const, width: 12 });
    const report: ReportResult = {
      title: "Expenses",
      subtitle: `${data.total} entries${q.month ? ` · ${q.month}` : ""} · total ₹${data.grandTotal.toLocaleString("en-IN")}`,
      columns: [
        { key: "date", label: "Date", type: "date", width: 12 },
        { key: "employee_name", label: "Employee", width: 22 },
        { key: "department", label: "Department", width: 16 },
        { key: "kind", label: "Kind", width: 9 },
        { key: "title", label: "Trip / purpose", width: 30 },
        money("hotel", "Hotel"),
        money("meals", "Meals"),
        money("local", "Local"),
        money("intercity", "Inter-city"),
        money("entertainment", "Entertainment"),
        money("others", "Others"),
        money("total", "Total"),
        money("approved", "Approved"),
        { key: "status", label: "Status", width: 11 },
      ],
      rows: data.all.map((r) => ({
        date: r.date,
        employee_name: r.employee_name,
        department: r.department ?? "",
        kind: r.kind === "claim" ? "Expense" : "Advance",
        title: r.title,
        hotel: r.hotel,
        meals: r.meals,
        local: r.local,
        intercity: r.intercity,
        entertainment: r.entertainment,
        others: r.others,
        total: r.total,
        approved: r.approved,
        status: r.status.replace("_", " "),
      })),
      totals: { employee_name: "Total", total: data.grandTotal },
      fileName: "expenses",
      landscape: true,
    };
    const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, currentUser(req).id));
    const body = await toXlsx(report, { company: (await loadBrand(cid(req))).company.name, printedBy: me?.name });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="expenses.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  }),
);

// ---- Advances ----
router.post("/advances", validate({ body: advanceSchema.merge(files) }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createAdvance(cid(req), currentUser(req), req.body))));
router.get("/advances/:id", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await advanceDetail(cid(req), currentUser(req), id(req)))));
router.post("/advances/:id/decision", validate({ params: idParams, body: decisionSchema }), asyncHandler(async (req, res) => res.json(await decideAdvance(cid(req), currentUser(req), id(req), req.body))));
router.post("/advances/:id/pay", requirePermission("expense.manage"), validate({ params: idParams, body: paySchema }), asyncHandler(async (req, res) => res.json(await payAdvance(cid(req), currentUser(req), id(req), req.body))));
router.post("/advances/:id/cancel", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await cancelAdvance(cid(req), currentUser(req), id(req)))));
router.get("/advances/:id/files/:index", validate({ params: fileParams }), asyncHandler(async (req, res) => res.json(await advanceFile(cid(req), currentUser(req), id(req), Number(req.params.index)))));

// ---- Claims ----
router.post("/claims", validate({ body: claimSchema.merge(files) }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await saveClaim(cid(req), currentUser(req), null, req.body))));
router.get("/claims/:id", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await claimDetail(cid(req), currentUser(req), id(req)))));
router.put("/claims/:id", validate({ params: idParams, body: claimSchema.merge(files) }), asyncHandler(async (req, res) => res.json(await saveClaim(cid(req), currentUser(req), id(req), req.body))));
router.post("/claims/:id/decision", validate({ params: idParams, body: decisionSchema }), asyncHandler(async (req, res) => res.json(await decideClaim(cid(req), currentUser(req), id(req), req.body))));
router.post("/claims/:id/pay", requirePermission("expense.manage"), validate({ params: idParams, body: paySchema }), asyncHandler(async (req, res) => res.json(await payClaim(cid(req), currentUser(req), id(req), req.body))));
router.delete(
  "/claims/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await deleteClaim(cid(req), currentUser(req), id(req));
    res.json({ success: true });
  }),
);
router.get("/claims/:id/files/:index", validate({ params: fileParams }), asyncHandler(async (req, res) => res.json(await claimFile(cid(req), currentUser(req), id(req), Number(req.params.index)))));
router.get(
  "/claims/:id/pdf",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const data = await claimDetail(cid(req), currentUser(req), id(req));
    const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, currentUser(req).id));
    const pdf = await expenseVoucherPdf(data, await loadBrand(cid(req)), me?.name);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="expense-${data.claim.id}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(pdf);
  }),
);

export const expenseRoutes = router;
