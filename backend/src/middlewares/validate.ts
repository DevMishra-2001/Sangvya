import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { ValidationError } from "../utils/httpErrors.js";

interface ValidationTargets {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

// Parses req.body / req.query / req.params with Zod schemas and replaces them
// with the parsed (trimmed, coerced) values — controllers only ever see valid input.
// Any failure → 400 { error: first problem, details: all problems }.
export function validate(schemas: ValidationTargets) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = await schemas.params.parseAsync(req.params);
      if (schemas.query) req.query = await schemas.query.parseAsync(req.query);
      if (schemas.body) req.body = await schemas.body.parseAsync(req.body ?? {});
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({ field: e.path.join("."), message: e.message }));
        return next(new ValidationError(details[0]?.message, details));
      }
      next(error);
    }
  };
}
