const env = require("../config/env");
const { generateCorrelationId } = require("../utils/correlationId");
const {
  formatDailySummary,
  formatMonthlyReport
} = require("../utils/messagePresenter");

class DeliveryWorker {
  constructor({ deliveryJobRepository, deliveryGateway, logger, metrics }) {
    this.deliveryJobRepository = deliveryJobRepository;
    this.deliveryGateway = deliveryGateway;
    this.logger = logger;
    this.metrics = metrics;
  }

  async processDueJobs(limit = 20) {
    const jobs = await this.deliveryJobRepository.findDueJobs(limit);

    for (const job of jobs) {
      const correlationId = generateCorrelationId();

      try {
        await this.deliveryJobRepository.markProcessing(job._id);

        const text = this.formatJob(job);
        await this.deliveryGateway.sendText({
          chatId: job.chatId,
          text,
          correlationId
        });

        await this.deliveryJobRepository.markCompleted(job._id);
        this.metrics.schedulerJobsTotal.inc({
          report_type: job.reportType,
          status: "completed"
        });

        this.logger.info("delivery_job_completed", {
          correlationId,
          jobId: job._id,
          reportType: job.reportType,
          userId: job.userId
        });
      } catch (error) {
        const attempts = Number(job.attempts || 0) + 1;
        const nextRetryAt = new Date(
          Date.now() + env.schedulerRetryDelayMinutes * 60 * 1000
        );

        await this.deliveryJobRepository.markRetry(
          job._id,
          attempts,
          nextRetryAt,
          error.message,
          Number(job.maxAttempts || env.schedulerMaxAttempts)
        );

        this.metrics.schedulerJobsTotal.inc({
          report_type: job.reportType,
          status: attempts >= Number(job.maxAttempts || env.schedulerMaxAttempts) ? "failed" : "retry"
        });

        this.logger.error("delivery_job_failed", {
          correlationId,
          jobId: job._id,
          reportType: job.reportType,
          userId: job.userId,
          attempts,
          error: error.message,
          stack: error.stack
        });
      }
    }
  }

  formatJob(job) {
    if (job.reportType === "daily") {
      return formatDailySummary(job.payload);
    }

    return formatMonthlyReport(job.payload);
  }
}

module.exports = DeliveryWorker;
