// Every error a request can end with. Services/middleware `throw new NotFoundError(...)`
// and the central errorHandler turns it into the JSON body the frontend reads:
//   { error: message, code?, details? }
// `code` is a machine-readable reason (e.g. TOKEN_EXPIRED) the frontend acts on.
import { HttpStatus, type HttpStatusCode } from "./httpStatus.js";

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code?: string;
  public readonly details?: ErrorDetail[];

  constructor(message: string, statusCode: HttpStatusCode, code?: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", code?: string) {
    super(message, HttpStatus.BAD_REQUEST, code);
  }
}

// Input failed a Zod schema. Message = first problem (shown in a toast); details = all of them.
export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: ErrorDetail[]) {
    super(message, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not logged in", code?: string) {
    super(message, HttpStatus.UNAUTHORIZED, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission for this action", code?: string) {
    super(message, HttpStatus.FORBIDDEN, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", code?: string) {
    super(message, HttpStatus.NOT_FOUND, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = "This record already exists", code?: string) {
    super(message, HttpStatus.CONFLICT, code);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Something went wrong on our end", code?: string) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, code);
  }
}
