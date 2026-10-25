import type { NextFunction, Request, RequestHandler, Response } from "express";

// Wraps an async controller so a thrown error / rejected promise goes to
// next(err) — the central errorHandler — instead of every controller needing
// its own try/catch.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
