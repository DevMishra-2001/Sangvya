const JobModel = require("../models/jobModel");

async function list(req, res) {
  const jobs = await JobModel.findAll(req.companyId);
  res.json({ jobs });
}

async function create(req, res) {
  const { title, department, location, description } = req.body;
  const job = await JobModel.create(req.companyId, { title, department, location, description });
  res.status(201).json({ job });
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // "open" | "closed"
  if (!["open", "closed"].includes(status)) {
    return res.status(400).json({ error: "Status must be 'open' or 'closed'" });
  }
  const job = await JobModel.updateStatus(req.companyId, id, status);
  if (!job) return res.status(404).json({ error: "Job posting not found" });
  res.json({ job });
}

async function remove(req, res) {
  const deleted = await JobModel.remove(req.companyId, req.params.id);
  if (!deleted) return res.status(404).json({ error: "Job posting not found" });
  res.json({ success: true });
}

module.exports = { list, create, updateStatus, remove };
