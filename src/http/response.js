function sendSuccess(res, { data, meta, statusCode = 200 }) {
  const payload = {
    success: true,
    correlationId: res.locals.correlationId,
    data
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

function sendError(res, { statusCode = 500, code = "INTERNAL_ERROR", message, details }) {
  const payload = {
    success: false,
    correlationId: res.locals.correlationId,
    error: {
      code,
      message
    }
  };

  if (details && Object.keys(details).length) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  sendError,
  sendSuccess
};
