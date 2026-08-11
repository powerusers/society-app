/** Errors the API raises deliberately. Anything else becomes a 500. */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new AppError(400, "bad_request", msg, details);
export const unauthorized = (msg = "Sign in to continue") => new AppError(401, "unauthorized", msg);
export const forbidden = (msg = "You do not have permission to do that", details) =>
  new AppError(403, "forbidden", msg, details);
export const notFound = (msg = "Not found") => new AppError(404, "not_found", msg);
export const conflict = (msg, details) => new AppError(409, "conflict", msg, details);
export const unprocessable = (msg, details) => new AppError(422, "unprocessable", msg, details);

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
