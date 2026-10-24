const CycleModel = require("../models/cycleModel");

async function list(req, res) {
  const cycles = await CycleModel.findAll(req.companyId);
  res.json({ cycles });
}

async function create(req, res) {
  const { name, startDate, endDate } = req.body;
  const cycle = await CycleModel.create(req.companyId, { name, startDate, endDate });
  res.status(201).json({ cycle });
}

async function updateStatus(req, res) {
  const { status } = req.body; // "active" | "closed"
  if (!["active", "closed"].includes(status)) {
    return res.status(400).json({ error: "Status must be 'active' or 'closed'" });
  }
  const cycle = await CycleModel.updateStatus(req.companyId, req.params.id, status);
  if (!cycle) return res.status(404).json({ error: "Review cycle not found" });
  res.json({ cycle });
}

module.exports = { list, create, updateStatus };
