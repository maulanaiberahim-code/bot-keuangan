const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    source: {
      type: String,
      default: "api"
    },
    chatId: {
      type: String,
      default: null
    },
    correlationId: {
      type: String,
      default: null
    },
    idempotencyKey: {
      type: String,
      default: null
    },
    dateKey: {
      type: String,
      required: true,
      index: true
    },
    monthKey: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, monthKey: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, dateKey: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, category: 1, monthKey: 1 });
transactionSchema.index({ userId: 1, type: 1, monthKey: 1 });
transactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    sparse: true
  }
);

module.exports = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
