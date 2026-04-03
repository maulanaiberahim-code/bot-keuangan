const UserModel = require("../models/UserModel");
const env = require("../../config/env");

class MongoUserRepository {
  async upsertContext({ userId, chatId = null, timezone = env.timezone }) {
    const role = env.adminUserIds.includes(userId) ? "admin" : "user";

    return UserModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          role,
          timezone,
          preferredChannel: "whatsapp",
          isActive: true,
          lastInteractionAt: new Date(),
          ...(chatId ? { lastKnownChatId: chatId } : {})
        },
        $setOnInsert: {
          balance: 0,
          pendingReset: false
        }
      },
      {
        upsert: true,
        new: true,
        lean: true
      }
    );
  }

  async findByUserId(userId) {
    return UserModel.findOne({ userId }).lean();
  }

  async incrementBalance(userId, delta) {
    return UserModel.findOneAndUpdate(
      { userId },
      {
        $inc: { balance: delta },
        $set: { lastInteractionAt: new Date() }
      },
      {
        new: true,
        lean: true
      }
    );
  }

  async setPendingReset(userId, pendingReset) {
    return UserModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          pendingReset
        }
      },
      {
        new: true,
        lean: true
      }
    );
  }

  async resetUserState(userId) {
    return UserModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          balance: 0,
          pendingReset: false,
          lastInteractionAt: new Date()
        }
      },
      {
        new: true,
        lean: true
      }
    );
  }

  async listUsers(filter = {}) {
    const query = {};

    if (filter.onlyActive) {
      query.isActive = true;
    }

    if (filter.onlyDeliverable) {
      query.lastKnownChatId = { $ne: null };
    }

    return UserModel.find(query)
      .sort({ lastInteractionAt: -1 })
      .lean();
  }

  async countUsers(filter = {}) {
    const query = {};

    if (filter.role) {
      query.role = filter.role;
    }

    return UserModel.countDocuments(query);
  }
}

module.exports = MongoUserRepository;
