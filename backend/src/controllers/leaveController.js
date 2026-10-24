const LeaveModel = require("../models/leaveModel");
const EmployeeModel = require("../models/employeeModel");
const HolidayModel = require("../models/holidayModel");
const { can } = require("../config/permissions");
const { isSunday } = require("../utils/workday");
const { checkBalance } = require("../utils/leaveBalance");

// cl (casual) | sl (sick) | ol (optional) | el (earned) | comp_off (earned by working a Sunday/holiday)
// "leave" (general) is kept for older requests.
const LEAVE_TYPES = ["leave", "cl", "sl", "ol", "el", "comp_off"];

// Checks the type-specific rules. Returns an error message, or null if OK.
async function checkLeaveRules(companyId, employeeId, { leaveType, fromDate, toDate }) {
  const singleDay = fromDate === toDate;
  const offDay = singleDay && (isSunday(fromDate) || (await HolidayModel.findByDate(companyId, fromDate)));

  // Comp off is earned automatically by working on a Sunday/holiday and is then
  // taken on a working day like any other leave (balance checked in checkBalance).
  if (offDay) return "This day is already off (Sunday/holiday) — no leave needed";

  const overlapping = await LeaveModel.findOverlapping(companyId, employeeId, fromDate, toDate);
  if (overlapping.length > 0) return "You already have a leave request covering these dates";
  return null;
}

async function list(req, res) {
  if (can(req.user.role, "leave.viewAll")) {
    return res.json({ leaves: await LeaveModel.findAll(req.companyId) });
  }
  // Without viewAll, a user only sees their own leaves
  if (!req.user.employeeId) return res.json({ leaves: [] });
  res.json({ leaves: await LeaveModel.findByEmployee(req.companyId, req.user.employeeId) });
}

async function create(req, res) {
  const { fromDate, toDate, reason } = req.body;
  const leaveType = req.body.leaveType || "cl";
  let employeeId = req.body.employeeId || req.user.employeeId;

  if (!employeeId) {
    return res.status(400).json({ error: "Your login isn't linked to an employee record — ask HR to link it" });
  }
  if (employeeId !== req.user.employeeId && !can(req.user.role, "leave.applyForOthers")) {
    return res.status(403).json({ error: "You can only apply leave for yourself" });
  }
  if (new Date(toDate) < new Date(fromDate)) {
    return res.status(400).json({ error: "toDate can't be before fromDate" });
  }
  const employee = await EmployeeModel.findById(req.companyId, employeeId);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const ruleError =
    (await checkLeaveRules(req.companyId, employeeId, { leaveType, fromDate, toDate })) ||
    (await checkBalance(req.companyId, employee, leaveType, fromDate.slice(0, 10), toDate.slice(0, 10)));
  if (ruleError) return res.status(400).json({ error: ruleError });

  const leave = await LeaveModel.create(req.companyId, { employeeId, fromDate, toDate, reason, leaveType });
  res.status(201).json({ leave: { ...leave, employee_name: employee.name } });
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // "approved" | "rejected"
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
  }

  const existing = await LeaveModel.findById(req.companyId, id);
  if (!existing) return res.status(404).json({ error: "Leave request not found" });
  // Nobody — not even a superadmin — approves or rejects their own leave
  if (req.user.employeeId && existing.employee_id === req.user.employeeId) {
    return res.status(403).json({ error: "You can't approve or reject your own leave" });
  }
  if (existing.status !== "pending") {
    return res.status(400).json({ error: `This leave is already ${existing.status}` });
  }

  // The employee's reporting manager decides. If they have no manager set,
  // HR / superadmin step in so the request isn't stuck.
  const employee = await EmployeeModel.findById(req.companyId, existing.employee_id);
  const isTheirManager = Boolean(req.user.employeeId) && employee?.manager_id === req.user.employeeId;
  const canStepIn = !employee?.manager_id && can(req.user.role, "leave.approveUnassigned");
  if (!isTheirManager && !canStepIn) {
    return res.status(403).json({
      error: employee?.manager_id
        ? "Only this employee's reporting manager can approve or reject their leave"
        : "You can't approve this leave",
    });
  }

  const leave = await LeaveModel.updateStatus(req.companyId, id, status, req.user.id);
  res.json({ leave: { ...leave, employee_name: existing.employee_name } });
}

module.exports = { list, create, updateStatus, LEAVE_TYPES };
