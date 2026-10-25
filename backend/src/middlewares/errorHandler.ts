import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError, NotFoundError } from "../utils/httpErrors.js";
import { HttpStatus } from "../utils/httpStatus.js";

interface PgError {
  code?: string;
  constraint?: string;
}

// Drizzle wraps driver errors (DrizzleQueryError) — the Postgres error is its `cause`.
function pgErrorOf(err: unknown): PgError | null {
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e?.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) return e as PgError;
  if (e?.cause) return pgErrorOf(e.cause);
  return null;
}

// Every error ends here, so every route answers with the same shape:
//   { error: "message", code?: "MACHINE_CODE", details?: [...] }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // File upload limits (multer)
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "The file is too large" : `Upload failed: ${err.message}`;
    return res.status(HttpStatus.BAD_REQUEST).json({ error: message });
  }

  const pg = pgErrorOf(err);
  // Unique-constraint violation (e.g. duplicate email)
  if (pg?.code === "23505") {
    const message =
      pg.constraint === "idx_employees_code"
        ? "This employee code is already used by another employee"
        : "This record already exists";
    return res.status(HttpStatus.CONFLICT).json({ error: message });
  }
  // Foreign-key violation (e.g. referencing a deleted employee)
  if (pg?.code === "23503") {
    return res.status(HttpStatus.BAD_REQUEST).json({ error: "Related record not found" });
  }

  // Errors from Express' own middleware (malformed JSON body, payload too large…)
  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json({ error: (err as Error).message });
  }

  console.error(err);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Something went wrong on our end" });
}

// 404 for unmatched routes
export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}
