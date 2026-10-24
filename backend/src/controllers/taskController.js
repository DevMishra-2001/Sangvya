const TaskModel = require("../models/taskModel");
const EmployeeModel = require("../models/employeeModel");
const { can } = require("../config/permissions");
const { localDate } = require("../utils/workday");

const STATUSES = ["todo", "in_progress", "done", "approved"];
const PRIORITIES = ["low", "medium", "high"];

const isOpen = (t) => t.status === "todo" || t.status === "in_progress";
const isOverdue = (t, today) => isOpen(t) && t.due_date && t.due_date < today;

// Who the current user may assign tasks to: HR/superadmin -> anyone,
// a manager -> their own team (employees whose "Reports to" is them).
async function assignableEmployees(req) {
  let list;
  if (can(req.user.role, "tasks.assignAnyone")) list = await EmployeeModel.findAll(req.companyId);
  else if (req.user.employeeId) list = await EmployeeModel.findReports(req.companyId, req.user.employeeId);
  else list = [];
  return list.filter((e) => e.id !== req.user.employeeId); // never yourself
}

// Approve/reopen/delete: the assigner, or HR/superadmin — but never the assignee.
function canReview(req, task) {
  if (req.user.employeeId && task.assigned_to === req.user.employeeId) return false;
  return task.assigned_by === req.user.id || can(req.user.role, "tasks.assignAnyone");
}

// Numbers for the dashboard charts.
function buildStats(tasks, today) {
  const counts = { approved: 0, done: 0, in_progress: 0, todo: 0, overdue: 0 };
  for (const t of tasks) counts[isOverdue(t, today) ? "overdue" : t.status]++;

  // Tasks completed (done/approved) per week, last 8 weeks, Monday-based
  const weekStart = (d) => {
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  };
  const thisWeek = weekStart(today);
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const w = new Date(`${thisWeek}T00:00:00Z`);
    w.setUTCDate(w.getUTCDate() - i * 7);
    weeks.push({ week: w.toISOString().slice(0, 10), completed: 0 });
  }
  for (const t of tasks) {
    if (!t.completed_at) continue;
    const slot = weeks.find((w) => w.week === weekStart(localDate(new Date(t.completed_at))));
    if (slot) slot.completed++;
  }

  const total = tasks.length;
  const finished = counts.done + counts.approved;
  const onTime = tasks.filter((t) => t.completed_at && (!t.due_date || localDate(new Date(t.completed_at)) <= t.due_date)).length;
  return {
    total,
    counts,
    weekly: weeks,
    completionRate: total ? Math.round((finished / total) * 100) : 0,
    onTimeRate: finished ? Math.round((onTime / finished) * 100) : 0,
    avgProgress: total ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total) : 0,
  };
}

const withFlags = (tasks, today) => tasks.map((t) => ({ ...t, overdue: Boolean(isOverdue(t, today)) }));

// GET /api/tasks/mine — tasks assigned to me + chart stats
async function mine(req, res) {
  if (!req.user.employeeId) return res.json({ tasks: [], stats: buildStats([], localDate()) });
  const today = localDate();
  const tasks = await TaskModel.findForAssignee(req.companyId, req.user.employeeId);
  res.json({ tasks: withFlags(tasks, today), stats: buildStats(tasks, today) });
}

// GET /api/tasks/assigned — tasks I handed out (HR/superadmin see the whole company)
async function assigned(req, res) {
  const today = localDate();
  const tasks = can(req.user.role, "tasks.assignAnyone")
    ? await TaskModel.findAll(req.companyId)
    : await TaskModel.findByAssigner(req.companyId, req.user.id);
  res.json({ tasks: withFlags(tasks, today) });
}

// GET /api/tasks/assignable
async function assignable(req, res) {
  const employees = await assignableEmployees(req);
  res.json({ employees: employees.map((e) => ({ id: e.id, name: e.name, designation: e.designation })) });
}

// POST /api/tasks
async function create(req, res) {
  const { title, description, priority = "medium", assignedTo, dueDate } = req.body;
  const allowed = await assignableEmployees(req);
  if (!allowed.some((e) => e.id === assignedTo)) {
    return res.status(403).json({ error: "You can only assign tasks to your own team" });
  }
  const assignedDate = localDate();
  if (dueDate && dueDate < assignedDate) return res.status(400).json({ error: "Due date can't be in the past" });

  const task = await TaskModel.create(req.companyId, {
    title, description, priority, assignedTo, assignedBy: req.user.id, dueDate, assignedDate,
  });
  res.status(201).json({ task: withFlags([task], assignedDate)[0] });
}

// PATCH /api/tasks/:id/progress — the assignee moves their own task along
async function updateProgress(req, res) {
  const task = await TaskModel.findById(req.companyId, req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (task.assigned_to !== req.user.employeeId) return res.status(403).json({ error: "This task isn't assigned to you" });
  if (task.status === "approved") return res.status(400).json({ error: "This task is already approved" });

  const status = req.body.status ?? task.status;
  if (!["todo", "in_progress", "done"].includes(status)) {
    return res.status(400).json({ error: "Status must be todo, in_progress or done" });
  }
  let progress = req.body.progress ?? task.progress;
  if (status === "done") progress = 100;
  else if (status === "todo") progress = 0;
  else progress = Math.min(99, Math.max(1, Number(progress) || 1)); // in progress: 1-99

  const updated = await TaskModel.updateProgress(req.companyId, task.id, { status, progress });
  res.json({ task: withFlags([updated], localDate())[0] });
}

// PATCH /api/tasks/:id/review  { action: "approve" | "reopen" }
async function review(req, res) {
  const task = await TaskModel.findById(req.companyId, req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!canReview(req, task)) return res.status(403).json({ error: "You can't review this task" });

  const { action } = req.body;
  let updated;
  if (action === "approve") {
    if (task.status !== "done") return res.status(400).json({ error: "Only a task marked done can be approved" });
    updated = await TaskModel.approve(req.companyId, task.id, req.user.id);
  } else if (action === "reopen") {
    if (!["done", "approved"].includes(task.status)) return res.status(400).json({ error: "Only a finished task can be reopened" });
    updated = await TaskModel.reopen(req.companyId, task.id);
  } else {
    return res.status(400).json({ error: "action must be 'approve' or 'reopen'" });
  }
  res.json({ task: withFlags([updated], localDate())[0] });
}

// DELETE /api/tasks/:id
async function remove(req, res) {
  const task = await TaskModel.findById(req.companyId, req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!canReview(req, task)) return res.status(403).json({ error: "You can't delete this task" });
  await TaskModel.remove(req.companyId, task.id);
  res.json({ success: true });
}

module.exports = { mine, assigned, assignable, create, updateProgress, review, remove, STATUSES, PRIORITIES };
