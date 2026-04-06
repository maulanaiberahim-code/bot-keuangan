const mongoose = require("mongoose");
const TransactionModel = require("../models/TransactionModel");

class MongoTransactionRepository {
  async createOrGetTransaction(transaction) {
    try {
      const created = await TransactionModel.create(transaction);
      return {
        duplicate: false,
        transaction: created.toObject()
      };
    } catch (error) {
      if (error.code === 11000 && transaction.idempotencyKey) {
        const existing = await this.findByIdempotencyKey(transaction.userId, transaction.idempotencyKey);
        return {
          duplicate: true,
          transaction: existing
        };
      }

      throw error;
    }
  }

  async findByIdempotencyKey(userId, idempotencyKey) {
    if (!idempotencyKey) {
      return null;
    }

    return TransactionModel.findOne({ userId, idempotencyKey }).lean();
  }

  async createTransaction(transaction) {
    const created = await TransactionModel.create(transaction);
    return created.toObject();
  }

  async findByIdForUser(transactionId, userId) {
    if (!mongoose.isValidObjectId(transactionId)) {
      return null;
    }

    return TransactionModel.findOne({
      _id: transactionId,
      userId
    }).lean();
  }

  async updateTransaction(transactionId, userId, updates) {
    if (!mongoose.isValidObjectId(transactionId)) {
      return null;
    }

    return TransactionModel.findOneAndUpdate(
      {
        _id: transactionId,
        userId
      },
      {
        $set: updates
      },
      {
        new: true,
        lean: true
      }
    );
  }

  async deleteTransaction(transactionId, userId) {
    if (!mongoose.isValidObjectId(transactionId)) {
      return null;
    }

    return TransactionModel.findOneAndDelete({
      _id: transactionId,
      userId
    }).lean();
  }

  async getBalanceForUser(userId) {
    const balances = await this.getBalancesByUserIds([userId]);
    return balances[userId] || 0;
  }

  async getBalancesByUserIds(userIds = []) {
    const normalizedUserIds = [...new Set(userIds.filter(Boolean))];

    if (!normalizedUserIds.length) {
      return {};
    }

    const items = await TransactionModel.aggregate([
      {
        $match: {
          userId: { $in: normalizedUserIds }
        }
      },
      {
        $group: {
          _id: "$userId",
          balance: {
            $sum: {
              $cond: [
                { $eq: ["$type", "income"] },
                "$amount",
                { $multiply: ["$amount", -1] }
              ]
            }
          }
        }
      }
    ]);

    return items.reduce((result, item) => {
      result[item._id] = item.balance;
      return result;
    }, {});
  }

  async listTransactions(filter = {}) {
    const query = {};

    if (filter.userId) {
      query.userId = filter.userId;
    }

    if (filter.type) {
      query.type = filter.type;
    }

    if (filter.category) {
      query.category = filter.category;
    }

    if (filter.monthKey) {
      query.monthKey = filter.monthKey;
    }

    if (filter.dateKey) {
      query.dateKey = filter.dateKey;
    }

    if (filter.fromDateKey || filter.toDateKey) {
      query.dateKey = {
        ...(filter.fromDateKey ? { $gte: filter.fromDateKey } : {}),
        ...(filter.toDateKey ? { $lte: filter.toDateKey } : {})
      };
    }

    const page = Number(filter.page || 1);
    const limit = Number(filter.limit || 20);

    const mongoQuery = TransactionModel.find(query).sort({ transactionAt: -1, createdAt: -1 });

    if (filter.disablePagination !== true) {
      mongoQuery.skip((page - 1) * limit).limit(limit);
    }

    return mongoQuery.lean();
  }

  async countTransactions(filter = {}) {
    const query = {};

    if (filter.userId) {
      query.userId = filter.userId;
    }

    if (filter.type) {
      query.type = filter.type;
    }

    if (filter.category) {
      query.category = filter.category;
    }

    if (filter.monthKey) {
      query.monthKey = filter.monthKey;
    }

    if (filter.dateKey) {
      query.dateKey = filter.dateKey;
    }

    if (filter.fromDateKey || filter.toDateKey) {
      query.dateKey = {
        ...(filter.fromDateKey ? { $gte: filter.fromDateKey } : {}),
        ...(filter.toDateKey ? { $lte: filter.toDateKey } : {})
      };
    }

    return TransactionModel.countDocuments(query);
  }

  async deleteByUserId(userId) {
    return TransactionModel.deleteMany({ userId });
  }
}

module.exports = MongoTransactionRepository;
