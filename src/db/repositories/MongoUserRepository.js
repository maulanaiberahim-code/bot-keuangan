const UserModel = require("../models/UserModel");
const env = require("../../config/env");

class MongoUserRepository {
  constructor(options = {}) {
    this.adminUserIds = new Set(options.adminUserIds || env.adminUserIds);
  }

  async upsertContext({ userId, chatId = null, timezone = env.timezone }) {
    const role = this.adminUserIds.has(userId) ? "admin" : "user";

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
          pendingReset: false,
          pendingDeleteTransactionId: null
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

  async touchContext({ userId, chatId = null, timezone = env.timezone }) {
    return UserModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          timezone,
          preferredChannel: "whatsapp",
          isActive: true,
          lastInteractionAt: new Date(),
          ...(chatId ? { lastKnownChatId: chatId } : {})
        }
      },
      {
        new: true,
        lean: true
      }
    );
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

  async setPendingDeleteTransactionId(userId, transactionId) {
    return UserModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          pendingDeleteTransactionId: transactionId,
          lastInteractionAt: new Date()
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
          pendingDeleteTransactionId: null,
          lastInteractionAt: new Date()
        }
      },
      {
        new: true,
        lean: true
      }
    );
  }

  async setBalance(userId, balance) {
    return UserModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          balance,
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
