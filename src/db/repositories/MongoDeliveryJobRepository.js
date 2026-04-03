const DeliveryJobModel = require("../models/DeliveryJobModel");

class MongoDeliveryJobRepository {
  async createOrGetJob(job) {
    try {
      const created = await DeliveryJobModel.create(job);
      return created.toObject();
    } catch (error) {
      if (error.code === 11000) {
        return DeliveryJobModel.findOne({
          userId: job.userId,
          reportType: job.reportType,
          periodKey: job.periodKey,
          channel: job.channel
        }).lean();
      }

      throw error;
    }
  }

  async findDueJobs(limit = 20) {
    return DeliveryJobModel.find({
      status: "pending",
      nextRetryAt: { $lte: new Date() },
      $expr: { $lt: ["$attempts", "$maxAttempts"] }
    })
      .sort({ nextRetryAt: 1 })
      .limit(limit)
      .lean();
  }

  async markProcessing(id) {
    return DeliveryJobModel.findByIdAndUpdate(
      id,
      { $set: { status: "processing" } },
      { new: true, lean: true }
    );
  }

  async markCompleted(id) {
    return DeliveryJobModel.findByIdAndUpdate(
      id,
      { $set: { status: "completed", lastError: null } },
      { new: true, lean: true }
    );
  }

  async markRetry(id, attempts, nextRetryAt, lastError, maxAttempts) {
    return DeliveryJobModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: attempts >= maxAttempts ? "failed" : "pending",
          attempts,
          nextRetryAt,
          lastError
        }
      },
      { new: true, lean: true }
    );
  }
}

module.exports = MongoDeliveryJobRepository;
