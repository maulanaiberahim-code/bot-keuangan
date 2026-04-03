const mongoose = require("mongoose");

const deliveryJobSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    chatId: {
      type: String,
      required: true
    },
    channel: {
      type: String,
      enum: ["whatsapp"],
      default: "whatsapp"
    },
    reportType: {
      type: String,
      enum: ["daily", "monthly"],
      required: true
    },
    periodKey: {
      type: String,
      required: true
    },
    payload: {
      type: Object,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    nextRetryAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastError: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

deliveryJobSchema.index(
  { userId: 1, reportType: 1, periodKey: 1, channel: 1 },
  {
    unique: true
  }
);

module.exports = mongoose.models.DeliveryJob || mongoose.model("DeliveryJob", deliveryJobSchema);
