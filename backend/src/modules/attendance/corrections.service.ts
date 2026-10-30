// Attendance corrections (regularisation).
import { and, desc, eq, gte, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { attendance, attendanceBreaks, attendanceCorrections, attendancePunches, employees, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { can } from "../../utils/can.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { localDate, zonedDateTime } from "../../utils/workday.js";
import { approverOf, canDecideFor } from "../employees/approver.js";
import { getEmployeeById } from "../employees/employees.service.js";
import { lateMinutes, rulesFor } from "../shifts/shiftRules.js";
import { hrRecipients, notify } from "../notifications/notify.js";
import { localTime } from "../../utils/workday.js";
import type { CorrectionDecisionInput, CorrectionInput } from "./attendance.schema.js";

const MAX_DAYS_BACK = 30;
const HR_PERMISSION = "attendance.mark" as const;

const manager = alias(employees, "manager");
const reviewer = alias(users, "reviewer");

function selectCorrections(...conditions: (SQL | undefined)[]) {
  return db
    .select({
      id: attendanceCorrections.id,
      employee_id: attendanceCorrections.employee_id,
      employee_name: employees.name,
      employee_photo: employees.photo_url,
      date: attendanceCorrections.date,
      punch_in: attendanceCorrections.punch_in,
      punch_out: attendanceCorrections.punch_out,
      reason: attendanceCorrections.reason,
      status: attendanceCorrections.status,
      review_note: attendanceCorrections.review_note,
      reviewed_at: attendanceCorrections.reviewed_at,
      reviewed_by_name: reviewer.name,
      created_at: attendanceCorrections.created_at,
      // What the day shows now, to compare
      current_in: attendance.punch_in,
      current_out: attendance.punch_out,
      manager_id: employees.manager_id,
      manager_name: manager.name,
      manager_status: manager.status,
    })
    .from(attendanceCorrections)
    .innerJoin(employees, eq(employees.id, attendanceCorrections.employee_id))
    .leftJoin(manager, eq(manager.id, employees.manager_id))
    .leftJoin(reviewer, eq(reviewer.id, attendanceCorrections.reviewed_by))
    .leftJoin(attendance, and(eq(attendance.employee_id, attendanceCorrections.employee_id), eq(attendance.date, attendanceCorrections.date)))
    .where(and(...conditions))
    .orderBy(desc(attendanceCorrections.created_at));
}

type Row = Awaited<ReturnType<typeof selectCorrections>>[number];
const present = (user: Express.AuthUser, { manager_status, ...row }: Row) => ({
  ...row,
  approver: approverOf({ manager_id: row.manager_id, manager_status }),
  can_decide: canDecideFor(user, { employee_id: row.employee_id, manager_id: row.manager_id, manager_status }, HR_PERMISSION),
});

// ---- The employee ----

export async function requestCorrection(companyId: number, user: Express.AuthUser, input: CorrectionInput) {
  const employeeId = user.employeeId!;
  const today = localDate();
  const oldest = new Date(`${today}T00:00:00Z`);
  oldest.setUTCDate(oldest.getUTCDate() - MAX_DAYS_BACK);
  if (input.date >= today) throw new BadRequestError("Only past days can be corrected — today you can still check in and out");
  if (input.date < oldest.toISOString().slice(0, 10)) throw new BadRequestError(`Only the last ${MAX_DAYS_BACK} days can be corrected`);

  const employee = await getEmployeeById(companyId, employeeId);
  if (employee.join_date && input.date < employee.join_date) throw new BadRequestError("That day is before you joined");

  const [pending] = await db
    .select({ id: attendanceCorrections.id })
    .from(attendanceCorrections)
    .where(and(eq(attendanceCorrections.employee_id, employeeId), eq(attendanceCorrections.date, input.date), eq(attendanceCorrections.status, "pending")));
  if (pending) throw new ConflictError("You already have a correction waiting for this day");

  const punchIn = zonedDateTime(input.date, input.punchIn);
  let punchOut = zonedDateTime(input.date, input.punchOut);
  if (punchOut <= punchIn) punchOut = new Date(punchOut.getTime() + 24 * 3600 * 1000); // night shift: out next morning

  const [row] = await db
    .insert(attendanceCorrections)
    .values({ company_id: companyId, employee_id: employeeId, date: input.date, punch_in: punchIn, punch_out: punchOut, reason: input.reason })
    .returning({ id: attendanceCorrections.id });
  const [correction] = await selectCorrections(eq(attendanceCorrections.id, row.id));
  // Tell whoever decides it
  void (async () => {
    const to = approverOf(correction) === "manager" ? [{ employeeId: correction.manager_id }] : await hrRecipients(companyId);
    await notify({
      companyId,
      to,
      type: "correction.requested",
      title: `${correction.employee_name} asked to correct ${input.date}`,
      body: `${localTime(punchIn)} – ${localTime(punchOut)} · ${input.reason}`,
      link: "/my-attendance/corrections",
      entity: ["correction", correction.id],
      actorId: user.id,
      email: (r) => ({
        template: "correctionRequested",
        props: { approverName: r.name, employeeName: correction.employee_name, date: input.date, punchIn: localTime(punchIn), punchOut: localTime(punchOut), reason: input.reason },
      }),
    });
  })();
  return { correction: present(user, correction) };
}

// GET /api/me/corrections — mine, newest first (last 90 days)
export async function myCorrections(companyId: number, user: Express.AuthUser) {
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const rows = await selectCorrections(
    eq(attendanceCorrections.company_id, companyId),
    eq(attendanceCorrections.employee_id, user.employeeId!),
    gte(attendanceCorrections.date, since),
  );
  return { corrections: rows.map((r) => present(user, r)) };
}

// Withdraw my own request while it's still waiting
export async function cancelCorrection(companyId: number, user: Express.AuthUser, id: number) {
  const [row] = await db
    .delete(attendanceCorrections)
    .where(
      and(
        eq(attendanceCorrections.company_id, companyId),
        eq(attendanceCorrections.id, id),
        eq(attendanceCorrections.employee_id, user.employeeId ?? -1),
        eq(attendanceCorrections.status, "pending"),
      ),
    )
    .returning({ id: attendanceCorrections.id });
  if (!row) throw new NotFoundError("No waiting correction to withdraw");
}

// ---- Approvers ----

// GET /api/attendance/corrections — HR (attendance.mark) sees the whole company; a manager sees their team's. can_decide says which ones are theirs to decide.
export async function listCorrections(companyId: number, user: Express.AuthUser, status: "pending" | "approved" | "rejected" | "all") {
  const byStatus = status === "all" ? undefined : eq(attendanceCorrections.status, status);
  if (can(user, HR_PERMISSION)) {
    return { corrections: (await selectCorrections(eq(attendanceCorrections.company_id, companyId), byStatus)).map((r) => present(user, r)) };
  }
  if (!user.employeeId) return { corrections: [] };
  const team = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.manager_id, user.employeeId)));
  if (!team.length) return { corrections: [] };
  const rows = await selectCorrections(
    eq(attendanceCorrections.company_id, companyId),
    byStatus,
    inArray(attendanceCorrections.employee_id, team.map((t) => t.id)),
  );
  return { corrections: rows.map((r) => present(user, r)) };
}

export async function decideCorrection(companyId: number, user: Express.AuthUser, id: number, { status, note }: CorrectionDecisionInput) {
  const [row] = await selectCorrections(eq(attendanceCorrections.company_id, companyId), eq(attendanceCorrections.id, id));
  if (!row) throw new NotFoundError("Correction not found");
  if (row.status !== "pending") throw new BadRequestError(`This correction is already ${row.status}`);
  if (!canDecideFor(user, row, HR_PERMISSION)) {
    if (user.employeeId === row.employee_id) throw new ForbiddenError("You can't approve your own correction");
    throw new ForbiddenError(
      approverOf(row) === "manager" ? `Only ${row.employee_name}'s reporting manager (${row.manager_name}) can decide this` : "You can't decide this correction",
    );
  }

  const reviewed = { status: status as "approved" | "rejected", review_note: note ?? null, reviewed_by: user.id, reviewed_at: new Date() };
  if (status === "rejected") {
    await db.update(attendanceCorrections).set(reviewed).where(eq(attendanceCorrections.id, id));
  } else {
    const rules = await rulesFor(companyId, row.employee_id);
    const late = lateMinutes(rules, row.punch_in);
    await db.transaction(async (tx) => {
      // The day becomes exactly the approved times
      const [day] = await tx
        .insert(attendance)
        .values({
          company_id: companyId,
          employee_id: row.employee_id,
          date: row.date,
          status: "present",
          punch_in: row.punch_in,
          punch_out: row.punch_out,
          punch_in_remarks: "Correction approved",
          punch_out_remarks: "Correction approved",
          late_minutes: late,
          day_closed_at: new Date(), // no end-of-day alert for a corrected day
        })
        .onConflictDoUpdate({
          target: [attendance.employee_id, attendance.date],
          set: {
            status: "present",
            punch_in: row.punch_in,
            punch_out: row.punch_out,
            punch_in_remarks: "Correction approved",
            punch_out_remarks: "Correction approved",
            late_minutes: late,
            day_closed_at: new Date(),
          },
        })
        .returning({ id: attendance.id });
      await tx.delete(attendanceBreaks).where(eq(attendanceBreaks.attendance_id, day.id));
      await tx.delete(attendancePunches).where(eq(attendancePunches.attendance_id, day.id));
      await tx.insert(attendancePunches).values([
        { company_id: companyId, attendance_id: day.id, kind: "in", punched_at: row.punch_in, remarks: "Correction approved" },
        { company_id: companyId, attendance_id: day.id, kind: "out", punched_at: row.punch_out, remarks: "Correction approved" },
      ]);
      await tx.update(attendanceCorrections).set(reviewed).where(eq(attendanceCorrections.id, id));
    });
  }
  audit(user, {
    companyId,
    action: status === "approved" ? "attendance.corrected" : "attendance.correction_rejected",
    target: ["employee", row.employee_id],
    summary: `${status === "approved" ? "Approved" : "Rejected"} ${row.employee_name}'s attendance correction for ${row.date}${note ? ` — ${note}` : ""}`,
  });
  const [updated] = await selectCorrections(eq(attendanceCorrections.id, id));
  const by = updated.reviewed_by_name ?? "Your manager";
  void notify({
    companyId,
    to: [{ employeeId: row.employee_id }],
    type: `correction.${status}`,
    title: `Your correction for ${row.date} was ${status}`,
    body: `By ${by}${note ? ` — “${note}”` : ""}`,
    link: "/my-attendance/corrections",
    entity: ["correction", id],
    actorId: user.id,
    email: (r) => ({ template: "correctionDecided", props: { name: r.name, status: status as "approved" | "rejected", by, date: row.date, note: note ?? null } }),
  });
  return { correction: present(user, updated) };
}

// For dashboards: how many corrections are waiting (whole company)
export async function pendingCorrectionCount(companyId: number) {
  const rows = await db
    .select({ id: attendanceCorrections.id })
    .from(attendanceCorrections)
    .where(and(eq(attendanceCorrections.company_id, companyId), eq(attendanceCorrections.status, "pending")));
  return rows.length;
}
