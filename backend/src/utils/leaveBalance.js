// Leave quotas and balances. The leave year is the financial year (1 Apr – 31 Mar).
//   CL  quota per year, unused days lapse at year end
//   SL  quota per year, unused days carry forward to the next year
//   OL  quota per year — employees.ol_quota, else the company default
//   EL  quota per month, unused days are paid out at month end (encashment)
//   Comp Off  earned automatically: 1 for every Sunday / holiday the employee
//             checked in on; valid COMP_OFF_VALID_DAYS (default 90) from that day
// Leave days exclude Sundays and company holidays. Pending requests count as
// used, so the same balance can't be requested twice.
const { query } = require("../config/db");
const { isSunday, localDate } = require("./workday");

const BALANCE_TYPES = ["cl", "sl", "ol", "el", "comp_off"];
const LABELS = { cl: "CL", sl: "SL", ol: "OL", el: "EL", comp_off: "Comp Off" };
const COMP_OFF_VALID_DAYS = Number(process.env.COMP_OFF_VALID_DAYS || 90);
const MAX_CARRY_YEARS = 10; // how far back SL carry-forward is computed

const iso = (d) => d.toISOString().slice(0, 10);

// Financial year containing a date: { start: "2026-04-01", end: "2027-03-31" }
function financialYear(dateIso) {
  const [y, m] = dateIso.split("-").map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31`, startYear };
}

function monthRange(dateIso) {
  const [y, m] = dateIso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${dateIso.slice(0, 7)}-01`, end: `${dateIso.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

async function getPolicy(companyId) {
  const res = await query(
    `INSERT INTO leave_policies (company_id) VALUES ($1)
     ON CONFLICT (company_id) DO UPDATE SET company_id = EXCLUDED.company_id
     RETURNING *`,
    [companyId]
  );
  const p = res.rows[0];
  return { cl_per_year: Number(p.cl_per_year), sl_per_year: Number(p.sl_per_year), ol_per_year: Number(p.ol_per_year), el_per_month: Number(p.el_per_month) };
}

async function updatePolicy(companyId, { clPerYear, slPerYear, olPerYear, elPerMonth }) {
  await getPolicy(companyId); // make sure the row exists
  await query(
    `UPDATE leave_policies SET cl_per_year = $2, sl_per_year = $3, ol_per_year = $4, el_per_month = $5, updated_at = now()
     WHERE company_id = $1`,
    [companyId, clPerYear, slPerYear, olPerYear, elPerMonth]
  );
  return getPolicy(companyId);
}

async function holidaySet(companyId, from, to) {
  const res = await query(`SELECT date FROM holidays WHERE company_id = $1 AND date BETWEEN $2 AND $3`, [companyId, from, to]);
  return new Set(res.rows.map((r) => r.date));
}

// Working days (not Sunday, not a holiday) between two dates, inclusive.
function workingDays(from, to, holidays) {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = iso(d);
    if (!isSunday(day) && !holidays.has(day)) n++;
  }
  return n;
}

async function countLeaveDays(companyId, from, to) {
  return workingDays(from, to, await holidaySet(companyId, from, to));
}

// Days of `type` leave (approved + pending) an employee has inside [from, to].
async function usedDays(companyId, employeeId, type, from, to, { excludeLeaveId = null } = {}) {
  const res = await query(
    `SELECT id, from_date, to_date FROM leave_requests
     WHERE company_id = $1 AND employee_id = $2 AND leave_type = $3 AND status IN ('approved', 'pending')
       AND from_date <= $5 AND to_date >= $4`,
    [companyId, employeeId, type, from, to]
  );
  if (res.rows.length === 0) return 0;
  const holidays = await holidaySet(companyId, from, to);
  return res.rows
    .filter((l) => l.id !== excludeLeaveId)
    .reduce((sum, l) => sum + workingDays(l.from_date > from ? l.from_date : from, l.to_date < to ? l.to_date : to, holidays), 0);
}

// SL available this financial year = this year's quota + unused SL carried from earlier years.
async function slCarryForward(companyId, employee, policy, fy) {
  const firstYear = employee.join_date ? financialYear(employee.join_date).startYear : fy.startYear;
  let carry = 0;
  for (let y = Math.max(firstYear, fy.startYear - MAX_CARRY_YEARS); y < fy.startYear; y++) {
    const used = await usedDays(companyId, employee.id, "sl", `${y}-04-01`, `${y + 1}-03-31`);
    carry = Math.max(0, carry + policy.sl_per_year - used);
  }
  return carry;
}

// Comp off: Sundays/holidays worked in the validity window, minus comp off
// leave days (pending + approved) taken in that window.
async function compOffBalance(companyId, employeeId, today) {
  const from = iso(new Date(new Date(`${today}T00:00:00Z`).getTime() - COMP_OFF_VALID_DAYS * 86400000));
  const worked = await query(
    `SELECT a.date FROM attendance a
     LEFT JOIN holidays h ON h.company_id = a.company_id AND h.date = a.date
     WHERE a.company_id = $1 AND a.employee_id = $2 AND a.date BETWEEN $3 AND $4
       AND (a.punch_in IS NOT NULL OR a.status = 'present')
       AND (EXTRACT(DOW FROM a.date) = 0 OR h.id IS NOT NULL)
     ORDER BY a.date`,
    [companyId, employeeId, from, today]
  );
  const earnedDates = worked.rows.map((r) => r.date);
  // Comp off leaves can be taken on future working days, so count from the window start onwards
  const used = await usedDays(companyId, employeeId, "comp_off", from, "9999-12-31");
  const earned = earnedDates.length;
  return { quota: earned, used, available: Math.max(0, earned - used), earnedDates, validDays: COMP_OFF_VALID_DAYS };
}

// { cl: { quota, used, available }, sl: {…, carriedForward}, ol: {…}, el: {…, month} }
async function getBalances(companyId, employee, asOf, today = asOf) {
  const policy = await getPolicy(companyId);
  const fy = financialYear(asOf);
  const month = monthRange(asOf);
  const olQuota = employee.ol_quota != null ? Number(employee.ol_quota) : policy.ol_per_year;
  const carried = await slCarryForward(companyId, employee, policy, fy);

  const make = async (type, quota, range, extra = {}) => {
    const used = await usedDays(companyId, employee.id, type, range.start, range.end);
    return { quota, used, available: Math.max(0, quota - used), ...extra };
  };

  return {
    financialYear: { start: fy.start, end: fy.end },
    cl: await make("cl", policy.cl_per_year, fy),
    sl: await make("sl", policy.sl_per_year + carried, fy, { carriedForward: carried }),
    ol: await make("ol", olQuota, fy),
    el: await make("el", policy.el_per_month, month, { month: asOf.slice(0, 7) }),
    comp_off: await compOffBalance(companyId, employee.id, today),
  };
}

// Error message if the employee can't take `type` leave for these dates, else null.
async function checkBalance(companyId, employee, type, from, to) {
  if (!BALANCE_TYPES.includes(type)) return null;
  const days = await countLeaveDays(companyId, from, to);
  if (days === 0) return "These dates are all Sundays/holidays — no leave needed";

  if (type === "el" && from.slice(0, 7) !== to.slice(0, 7)) {
    return "EL is a monthly leave — apply for each month separately";
  }
  if (!["el", "comp_off"].includes(type) && financialYear(from).start !== financialYear(to).start) {
    return "A leave can't span two financial years — please split it at 31 March";
  }
  const balance = (await getBalances(companyId, employee, from, localDate()))[type];
  if (days > balance.available) {
    return `Not enough ${LABELS[type]} balance: you asked for ${days} day${days > 1 ? "s" : ""}, ${balance.available} available`;
  }
  return null;
}

module.exports = { BALANCE_TYPES, financialYear, getPolicy, updatePolicy, getBalances, checkBalance, countLeaveDays };
