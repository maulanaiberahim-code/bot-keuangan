const logger = require("../utils/logger");
const AppError = require("../errors/AppError");

function handleAppError(error, context = {}) {
  const normalizedError = error instanceof AppError
    ? error
    : new AppError("Terjadi kesalahan internal.", 500, "INTERNAL_ERROR");

  logger.error("request_failed", {
    correlationId: context.correlationId,
    userId: context.userId,
    command: context.command,
    code: normalizedError.code,
    statusCode: normalizedError.statusCode,
    errorMessage: error.message,
    stack: error.stack,
    details: normalizedError.details
  });

  return `Terjadi kesalahan: ${normalizedError.message}`;
}

module.exports = {
  handleAppError
};
