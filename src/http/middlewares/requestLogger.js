function requestLogger({ logger, metrics }) {
  return function logRequest(req, res, next) {
    const startedAt = Date.now();

    logger.info("http_request_received", {
      correlationId: req.context.correlationId,
      method: req.method,
      path: req.originalUrl,
      command: req.context.commandName,
      userId: req.query.userId || req.body?.userId || null,
      ip: req.ip
    });

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const route = req.route?.path || req.baseUrl || req.path || "unmatched";
      const status = String(res.statusCode);

      metrics.httpRequestTotal.inc({
        method: req.method,
        route,
        status
      });

      metrics.httpRequestDurationMs.observe(
        {
          method: req.method,
          route,
          status
        },
        durationMs
      );

      if (req.context.commandName) {
        metrics.commandUsageTotal.inc({
          channel: "whatsapp",
          command: req.context.commandName
        });
      }

      logger.info("http_request_completed", {
        correlationId: req.context.correlationId,
        method: req.method,
        path: req.originalUrl,
        route,
        statusCode: res.statusCode,
        durationMs
      });
    });

    next();
  };
}

module.exports = requestLogger;
