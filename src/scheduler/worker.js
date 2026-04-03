const cron = require("node-cron");
const logger = require("../utils/logger");
const env = require("../config/env");
const { connectDatabase, disconnectDatabase } = require("../db/connection");
const createAppContext = require("../app/createAppContext");
const ReportScheduler = require("./reportScheduler");
const DeliveryWorker = require("./deliveryWorker");
const DeliveryGateway = require("./deliveryGateway");

async function startWorker() {
  await connectDatabase();

  const context = createAppContext({
    serviceName: "scheduler"
  });

  const reportScheduler = new ReportScheduler({
    financeService: context.services.coreFinanceService,
    logger: context.logger,
    metrics: context.metrics
  });

  const deliveryWorker = new DeliveryWorker({
    deliveryJobRepository: context.repositories.deliveryJobRepository,
    deliveryGateway: new DeliveryGateway(),
    logger: context.logger,
    metrics: context.metrics
  });

  if (env.enableDailyScheduler) {
    cron.schedule(env.dailyReportCron, async () => {
      await runSafely("daily_report_scheduler", () => reportScheduler.enqueueDailyReports(), logger);
    }, { timezone: env.timezone });
  }

  if (env.enableMonthlyScheduler) {
    cron.schedule(env.monthlyReportCron, async () => {
      await runSafely("monthly_report_scheduler", () => reportScheduler.enqueueMonthlyReports(), logger);
    }, { timezone: env.timezone });
  }

  if (env.enableRetryWorker) {
    cron.schedule(env.retryCron, async () => {
      await runSafely("delivery_retry_worker", () => deliveryWorker.processDueJobs(), logger);
    }, { timezone: env.timezone });
  }

  logger.info("scheduler_worker_started", {
    dailyScheduler: env.enableDailyScheduler,
    monthlyScheduler: env.enableMonthlyScheduler,
    retryWorker: env.enableRetryWorker,
    timezone: env.timezone
  });

  const shutdown = async (signal) => {
    logger.warn("scheduler_worker_shutdown_signal", { signal });
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function runSafely(jobName, handler, logger) {
  try {
    await handler();
  } catch (error) {
    logger.error("scheduler_job_failed", {
      jobName,
      error: error.message,
      stack: error.stack
    });
  }
}

startWorker().catch((error) => {
  logger.error("scheduler_worker_failed", {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
