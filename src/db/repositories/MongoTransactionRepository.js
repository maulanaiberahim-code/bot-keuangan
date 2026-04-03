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

    const mongoQuery = TransactionModel.find(query).sort({ createdAt: -1 });

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
