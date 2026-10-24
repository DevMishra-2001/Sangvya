const CandidateModel = require("../models/candidateModel");
const EmployeeModel = require("../models/employeeModel");
const { syncSubscriptionQuantity } = require("../utils/syncSubscriptionQuantity");

const VALID_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];

async function list(req, res) {
  const candidates = await CandidateModel.findAll(req.companyId);
  res.json({ candidates });
}

async function create(req, res) {
  const { jobPostingId, name, email, phone, resumeUrl, notes } = req.body;
  const candidate = await CandidateModel.create(req.companyId, {
    jobPostingId, name, email, phone, resumeUrl, notes,
  });
  res.status(201).json({ candidate });
}

async function updateStage(req, res) {
  const { stage } = req.body;
  if (!VALID_STAGES.includes(stage)) {
    return res.status(400).json({ error: `Stage must be one of: ${VALID_STAGES.join(", ")}` });
  }
  const candidate = await CandidateModel.updateStage(req.companyId, req.params.id, stage);
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });

  // When a candidate is marked "hired", offer to auto-create the employee
  // record so HR doesn't have to re-type the same details into Employees.
  res.json({ candidate });
}

async function update(req, res) {
  const { name, email, phone, notes } = req.body;
  const candidate = await CandidateModel.update(req.companyId, req.params.id, { name, email, phone, notes });
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });
  res.json({ candidate });
}

async function remove(req, res) {
  const deleted = await CandidateModel.remove(req.companyId, req.params.id);
  if (!deleted) return res.status(404).json({ error: "Candidate not found" });
  res.json({ success: true });
}

// POST /api/recruitment/candidates/:id/convert-to-employee
// Convenience action for a "hired" candidate — creates a matching Employee
// record so the person now shows up in Employees/Attendance/Payroll too.
async function convertToEmployee(req, res) {
  const candidate = await CandidateModel.findAll(req.companyId);
  const match = candidate.find((c) => c.id === req.params.id);
  if (!match) return res.status(404).json({ error: "Candidate not found" });

  const employee = await EmployeeModel.create(req.companyId, {
    name: match.name,
    designation: match.job_title,
    department: null,
    email: match.email,
    joinDate: new Date().toISOString().slice(0, 10),
    salary: null,
  });
  await syncSubscriptionQuantity(req.companyId);

  res.status(201).json({ employee });
}

module.exports = { list, create, updateStage, update, remove, convertToEmployee };
