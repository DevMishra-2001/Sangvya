import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { createHoliday, deleteHoliday, listHolidays, updateHoliday } from "./holidays.service.js";

// GET /api/holidays?year= — every logged-in user can see the holiday list
export const listHolidaysHandler = asyncHandler(async (req, res) => {
  res.json(await listHolidays(tenant(req).companyId, (req.query as { year?: number }).year));
});

// POST /api/holidays  { date, name, isOptional }
export const createHolidayHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createHoliday(tenant(req).companyId, currentUser(req), req.body));
});

// PUT /api/holidays/:id
export const updateHolidayHandler = asyncHandler(async (req, res) => {
  res.json(await updateHoliday(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body));
});

// DELETE /api/holidays/:id
export const deleteHolidayHandler = asyncHandler(async (req, res) => {
  await deleteHoliday(tenant(req).companyId, currentUser(req), Number(req.params.id));
  res.json({ success: true });
});
