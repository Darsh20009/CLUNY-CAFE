/**
 * Phase 9 — Result<T, E> pattern for typed error handling without exceptions.
 * Forces callers to handle both success and failure paths.
 */

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly meta?: Record<string, any>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  notFound: (what: string) => new AppError("NOT_FOUND", 404, `${what} not found`),
  unauthorized: (msg = "Unauthorized") => new AppError("UNAUTHORIZED", 401, msg),
  forbidden: (msg = "Forbidden") => new AppError("FORBIDDEN", 403, msg),
  badRequest: (msg: string, meta?: any) => new AppError("BAD_REQUEST", 400, msg, meta),
  validation: (msg: string, meta?: any) => new AppError("VALIDATION", 422, msg, meta),
  conflict: (msg: string) => new AppError("CONFLICT", 409, msg),
  internal: (msg = "Internal error", meta?: any) => new AppError("INTERNAL", 500, msg, meta),
  rateLimit: () => new AppError("RATE_LIMIT", 429, "Too many requests"),
};

/** Wraps a promise into a Result, catching thrown errors. */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, AppError>> {
  try { return Ok(await fn()); }
  catch (e: any) {
    if (e instanceof AppError) return Err(e);
    return Err(Errors.internal(e?.message || String(e)));
  }
}
