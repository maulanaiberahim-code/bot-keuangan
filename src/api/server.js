const env = require("../config/env");
const logger = require("../utils/logger");
const { connectDatabase, disconnectDatabase } = require("../db/connection");
const createApp = require("./createApp");

async function startServer() {
  await connectDatabase();

  const { app } = createApp();
  const server = app.listen(env.port, () => {
    logger.info("api_server_started", {
      port: env.port,
      environment: env.nodeEnv
    });
  });

  const shutdown = async (signal) => {
    logger.warn("api_server_shutdown_signal", { signal });

    server.close(async () => {
      await disconnectDatabase();
      logger.info("api_server_stopped", { signal });
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}

startServer().catch((error) => {
  logger.error("api_server_failed", {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
