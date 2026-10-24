const EmployeeModel = require("../models/employeeModel");
const { syncSubscriptionQuantity } = require("../utils/syncSubscriptionQuantity");

// The "reports to" manager must be another employee of this same company.
async function checkManager(companyId, managerId, employeeId = null) {
  if (!managerId) return null;
  if (managerId === employeeId) return "An employee can't report to themselves";
  const manager = await EmployeeModel.findById(companyId, managerId);
  return manager ? null : "Manager not found";
}

async function list(req, res) {
  const employees = await EmployeeModel.findAll(req.companyId);
  res.json({ employees });
}

async function create(req, res) {
  const { name, designation, department, email, joinDate, salary, managerId, dateOfBirth, olQuota, employeeCode } = req.body;
  const managerError = await checkManager(req.companyId, managerId);
  if (managerError) return res.status(400).json({ error: managerError });

  const employee = await EmployeeModel.create(req.companyId, {
    name, designation, department, email, joinDate, salary, managerId, dateOfBirth, olQuota, employeeCode,
  });
  // Billing is per-employee, so headcount changes must be reflected in the
  // subscription — this keeps the next invoice amount accurate.
  await syncSubscriptionQuantity(req.companyId);
  res.status(201).json({ employee });
}

async function update(req, res) {
  const { id } = req.params;
  const existing = await EmployeeModel.findById(req.companyId, id);
  if (!existing) return res.status(404).json({ error: "Employee not found" });

  const { name, designation, department, email, joinDate, salary, managerId, dateOfBirth, olQuota, employeeCode } = req.body;
  const managerError = await checkManager(req.companyId, managerId, id);
  if (managerError) return res.status(400).json({ error: managerError });

  const employee = await EmployeeModel.update(req.companyId, id, {
    name, designation, department, email, joinDate, salary, managerId, dateOfBirth, olQuota, employeeCode,
  });
  res.json({ employee });
}

async function remove(req, res) {
  const { id } = req.params;
  const deleted = await EmployeeModel.remove(req.companyId, id);
  if (!deleted) return res.status(404).json({ error: "Employee not found" });
  await syncSubscriptionQuantity(req.companyId);
  res.json({ success: true });
}

module.exports = { list, create, update, remove };
