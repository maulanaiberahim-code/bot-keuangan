const mongoose = require("mongoose");
const env = require("../../config/env");

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true
    },
    balance: {
      type: Number,
      default: 0
    },
    pendingReset: {
      type: Boolean,
      default: false
    },
    timezone: {
      type: String,
      default: env.timezone
    },
    preferredChannel: {
      type: String,
      default: "whatsapp"
    },
    lastKnownChatId: {
      type: String,
      default: null
    },
    lastInteractionAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ lastInteractionAt: -1 });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
