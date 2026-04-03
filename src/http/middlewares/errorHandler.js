const { ZodError } = require("zod");
const AppError = require("../../errors/AppError");
const { sendError } = require("../response");

function errorHandler({ logger, metrics }) {
  return function handleError(error, req, res, _next) {
    const normalized = normalizeError(error);

    metrics.appErrorsTotal.inc({
      scope: "http",
      code: normalized.code
    });

    logger.error("http_request_failed", {
      correlationId: req.context?.correlationId || res.locals.correlationId || null,
      method: req.method,
      path: req.originalUrl,
      code: normalized.code,
      statusCode: normalized.statusCode,
      errorMessage: normalized.message,
      details: normalized.details,
      stack: error.stack
    });

    return sendError(res, normalized);
  };
}

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(
      "Payload request tidak valid.",
      400,
      "VALIDATION_ERROR",
      {
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      }
    );
  }

  return new AppError("Terjadi kesalahan internal.", 500, "INTERNAL_ERROR");
}

module.exports = errorHandler;
