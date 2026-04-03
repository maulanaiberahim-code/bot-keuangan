const express = require("express");
const helmet = require("helmet");
const env = require("../config/env");
const createAppContext = require("../app/createAppContext");
const createRateLimiter = require("../http/middlewares/createRateLimiter");
const requestContext = require("../http/middlewares/requestContext");
const requestLogger = require("../http/middlewares/requestLogger");
const apiKeyAuth = require("../http/middlewares/apiKeyAuth");
const errorHandler = require("../http/middlewares/errorHandler");
const notFoundHandler = require("../http/middlewares/notFoundHandler");
const createApiRouter = require("./routes/createApiRouter");
const createSystemController = require("./controllers/systemController");

function createApp(options = {}) {
  const context = options.context || createAppContext({
    serviceName: options.serviceName || "api",
    ...options
  });
  const apiKey = options.apiKey ?? env.apiKey;

  const app = express();
  const systemController = createSystemController(context);
  const limiter = createRateLimiter({
    windowMs: options.rateLimitWindowMs ?? env.rateLimitWindowMs,
    max: options.rateLimitMax ?? env.rateLimitMax
  });

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestContext);
  app.use(requestLogger({
    logger: context.logger,
    metrics: context.metrics
  }));

  app.get("/health", systemController.health);
  app.get("/metrics", apiKeyAuth({ apiKey }), systemController.metrics);

  app.use("/api/v1", limiter, apiKeyAuth({ apiKey }), createApiRouter(context));

  app.use(notFoundHandler);
  app.use(errorHandler({
    logger: context.logger,
    metrics: context.metrics
  }));

  return {
    app,
    context
  };
}

module.exports = createApp;
