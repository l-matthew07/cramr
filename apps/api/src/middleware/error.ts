import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "validation", issues: err.issues });
  }
  const e = err as { status?: number; message?: string; code?: string };
  const status = e.status ?? 500;
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({
    error: e.code ?? e.message ?? "internal_error",
  });
}

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}
