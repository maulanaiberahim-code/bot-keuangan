const { generateCorrelationId } = require("../../utils/correlationId");

function requestContext(req, res, next) {
  const correlationId = req.headers["x-correlation-id"] || generateCorrelationId();
  const commandName = req.headers["x-command-name"] || null;

  req.context = {
    correlationId,
    commandName,
    startedAt: Date.now()
  };

  res.locals.correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);

  next();
}

module.exports = requestContext;
