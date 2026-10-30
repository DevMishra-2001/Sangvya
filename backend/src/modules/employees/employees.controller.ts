import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { createEmployeeWithLogin, updateEmployeeWithLogin } from "./employeeAccount.service.js";
import { deleteAllDocumentFiles, deleteDocument, documentLink, listDocuments, uploadDocument } from "./employeeDocuments.service.js";
import { cancelExit, rehire, startExit } from "./employeeExit.service.js";
import { deleteEmployee, getEmployeeById, listEmployees } from "./employees.service.js";

// GET /api/employees
export const listEmployeesHandler = asyncHandler(async (req, res) => {
  res.json(await listEmployees(tenant(req).companyId));
});

// POST /api/employees
export const createEmployeeHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createEmployeeWithLogin(tenant(req).companyId, currentUser(req), req.body));
});

// PUT /api/employees/:id
export const updateEmployeeHandler = asyncHandler(async (req, res) => {
  res.json(await updateEmployeeWithLogin(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body));
});

// DELETE /api/employees/:id
export const deleteEmployeeHandler = asyncHandler(async (req, res) => {
  const { companyId } = tenant(req);
  const id = Number(req.params.id);
  await getEmployeeById(companyId, id); // 404 before touching any files
  await deleteAllDocumentFiles(companyId, id);
  await deleteEmployee(companyId, currentUser(req), id);
  res.json({ success: true });
});


// GET /api/employees/:id
export const getEmployeeHandler = asyncHandler(async (req, res) => {
  res.json({ employee: await getEmployeeById(tenant(req).companyId, Number(req.params.id)) });
});

// POST /api/employees/:id/exit  { lastWorkingDay, reason, notes? }
export const exitHandler = asyncHandler(async (req, res) => {
  res.json(await startExit(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body));
});

// POST /api/employees/:id/cancel-exit
export const cancelExitHandler = asyncHandler(async (req, res) => {
  res.json(await cancelExit(tenant(req).companyId, currentUser(req), Number(req.params.id)));
});

// POST /api/employees/:id/rehire
export const rehireHandler = asyncHandler(async (req, res) => {
  res.json(await rehire(tenant(req).companyId, currentUser(req), Number(req.params.id)));
});

// GET /api/employees/:id/documents
export const listDocumentsHandler = asyncHandler(async (req, res) => {
  res.json(await listDocuments(tenant(req).companyId, Number(req.params.id)));
});

// POST /api/employees/:id/documents  (multipart: file, name?, category)
export const uploadDocumentHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await uploadDocument(tenant(req).companyId, currentUser(req), Number(req.params.id), req.file, req.body));
});

// GET /api/employees/:id/documents/:docId/link → { url } valid for a few minutes
export const documentLinkHandler = asyncHandler(async (req, res) => {
  res.json(await documentLink(tenant(req).companyId, Number(req.params.id), Number(req.params.docId)));
});

// DELETE /api/employees/:id/documents/:docId
export const deleteDocumentHandler = asyncHandler(async (req, res) => {
  await deleteDocument(tenant(req).companyId, currentUser(req), Number(req.params.id), Number(req.params.docId));
  res.json({ success: true });
});
