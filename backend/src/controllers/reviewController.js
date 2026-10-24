const ReviewModel = require("../models/reviewModel");

async function listByCycle(req, res) {
  const reviews = await ReviewModel.findByCycle(req.companyId, req.params.cycleId);
  res.json({ reviews });
}

async function listByEmployee(req, res) {
  const reviews = await ReviewModel.findByEmployee(req.companyId, req.params.employeeId);
  res.json({ reviews });
}

// POST /api/performance/reviews  — create or update (draft/submit) in one call
async function upsert(req, res) {
  const { cycleId, employeeId, rating, strengths, improvements, goalsNextCycle, managerComments, status } = req.body;
  const review = await ReviewModel.upsert(req.companyId, {
    cycleId, employeeId, rating, strengths, improvements, goalsNextCycle, managerComments, status,
  });
  res.status(201).json({ review });
}

// PATCH /api/performance/reviews/:id/status — e.g. employee acknowledges a submitted review
async function updateStatus(req, res) {
  const { status } = req.body;
  if (!["draft", "submitted", "acknowledged"].includes(status)) {
    return res.status(400).json({ error: "Status must be draft, submitted, or acknowledged" });
  }
  const review = await ReviewModel.updateStatus(req.companyId, req.params.id, status);
  if (!review) return res.status(404).json({ error: "Review not found" });
  res.json({ review });
}

module.exports = { listByCycle, listByEmployee, upsert, updateStatus };
