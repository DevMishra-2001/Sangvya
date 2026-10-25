import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { createHoliday, deleteHoliday, listHolidays } from "./holidays.service.js";

// GET /api/holidays — every logged-in user can see the holiday list
export const listHolidaysHandler = asyncHandler(async (req, res) => {
  res.json(await listHolidays(tenant(req).companyId));
});

// POST /api/holidays
export const createHolidayHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createHoliday(tenant(req).companyId, req.body));
});

// DELETE /api/holidays/:id
export const deleteHolidayHandler = asyncHandler(async (req, res) => {
  await deleteHoliday(tenant(req).companyId, Number(req.params.id));
  res.json({ success: true });
});
