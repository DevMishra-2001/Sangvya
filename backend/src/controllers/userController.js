const bcrypt = require("bcryptjs");
const UserModel = require("../models/userModel");
const EmployeeModel = require("../models/employeeModel");
const { ROLES, ROLE_LEVEL } = require("../config/permissions");

// A user may only manage accounts strictly below their own level
// (superadmin is the exception and can manage anyone, incl. other superadmins).
function canManageRole(actorRole, targetRole) {
  if (actorRole === "superadmin") return true;
  return ROLE_LEVEL[targetRole] < ROLE_LEVEL[actorRole];
}

// Validates an optional employeeId: must belong to this company and not
// already be linked to a different login. Returns an error string or null.
async function checkEmployeeLink(companyId, employeeId, userId = null) {
  if (!employeeId) return null;
  const employee = await EmployeeModel.findById(companyId, employeeId);
  if (!employee) return "Employee not found";
  const linked = await UserModel.findByEmployeeId(companyId, employeeId);
  if (linked && linked.id !== userId) return "This employee already has a login";
  return null;
}

async function list(req, res) {
  const users = await UserModel.findAll(req.companyId);
  res.json({ users, roles: ROLES });
}

async function create(req, res) {
  const { name, email, password, role, employeeId } = req.body;

  if (!canManageRole(req.user.role, role)) {
    return res.status(403).json({ error: `You can't create a ${role} account` });
  }
  if (await UserModel.findByEmail(email)) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }
  const linkError = await checkEmployeeLink(req.companyId, employeeId);
  if (linkError) return res.status(400).json({ error: linkError });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({
    companyId: req.companyId, name, email, passwordHash, role, employeeId: employeeId || null,
  });
  res.status(201).json({ user });
}

async function update(req, res) {
  const { id } = req.params;
  const existing = await UserModel.findInCompany(req.companyId, id);
  if (!existing) return res.status(404).json({ error: "User not found" });

  const name = req.body.name ?? existing.name;
  const role = req.body.role ?? existing.role;
  const employeeId = req.body.employeeId !== undefined ? req.body.employeeId || null : existing.employee_id;

  const isSelf = existing.id === req.user.id;
  if (isSelf && role !== existing.role) {
    return res.status(400).json({ error: "You can't change your own role" });
  }
  // Editing yourself (name / employee link) is fine; otherwise the target must rank below you
  if (!isSelf && (!canManageRole(req.user.role, existing.role) || !canManageRole(req.user.role, role))) {
    return res.status(403).json({ error: "You don't have permission to change this account" });
  }
  const linkError = await checkEmployeeLink(req.companyId, employeeId, existing.id);
  if (linkError) return res.status(400).json({ error: linkError });

  const user = await UserModel.update(req.companyId, id, { name, role, employeeId });
  res.json({ user });
}

async function remove(req, res) {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: "You can't delete your own account" });

  const existing = await UserModel.findInCompany(req.companyId, id);
  if (!existing) return res.status(404).json({ error: "User not found" });
  if (!canManageRole(req.user.role, existing.role)) {
    return res.status(403).json({ error: "You don't have permission to delete this account" });
  }
  await UserModel.remove(req.companyId, id);
  res.json({ success: true });
}

module.exports = { list, create, update, remove };
