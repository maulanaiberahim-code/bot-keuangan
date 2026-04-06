class InMemoryUserRepository {
  constructor(options = {}) {
    this.users = new Map();
    this.adminUserIds = new Set(options.adminUserIds || []);
  }

  async upsertContext({ userId, chatId = null, timezone = "Asia/Jakarta", role = null }) {
    const current = this.users.get(userId) || {
      userId,
      role: this.adminUserIds.has(userId) ? "admin" : "user",
      balance: 0,
      pendingReset: false,
      pendingDeleteTransactionId: null,
      timezone,
      preferredChannel: "whatsapp",
      lastKnownChatId: null,
      lastInteractionAt: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const next = {
      ...current,
      role: role || current.role,
      timezone,
      preferredChannel: "whatsapp",
      isActive: true,
      lastInteractionAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(chatId ? { lastKnownChatId: chatId } : {})
    };

    this.users.set(userId, next);
    return next;
  }

  async findByUserId(userId) {
    return this.users.get(userId) || null;
  }

  async touchContext({ userId, chatId = null, timezone = "Asia/Jakarta" }) {
    const user = await this.findByUserId(userId);

    if (!user) {
      return null;
    }

    const next = {
      ...user,
      timezone,
      preferredChannel: "whatsapp",
      isActive: true,
      lastInteractionAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(chatId ? { lastKnownChatId: chatId } : {})
    };

    this.users.set(userId, next);
    return next;
  }

  async incrementBalance(userId, delta) {
    const user = await this.findByUserId(userId);
    const next = { ...user, balance: user.balance + delta, updatedAt: new Date().toISOString() };
    this.users.set(userId, next);
    return next;
  }

  async setPendingReset(userId, pendingReset) {
    const user = await this.findByUserId(userId);
    const next = { ...user, pendingReset, updatedAt: new Date().toISOString() };
    this.users.set(userId, next);
    return next;
  }

  async setPendingDeleteTransactionId(userId, transactionId) {
    const user = await this.findByUserId(userId);
    const next = { ...user, pendingDeleteTransactionId: transactionId, updatedAt: new Date().toISOString() };
    this.users.set(userId, next);
    return next;
  }

  async resetUserState(userId) {
    const user = await this.findByUserId(userId);
    const next = {
      ...user,
      balance: 0,
      pendingReset: false,
      pendingDeleteTransactionId: null,
      updatedAt: new Date().toISOString()
    };
    this.users.set(userId, next);
    return next;
  }

  async setBalance(userId, balance) {
    const user = await this.findByUserId(userId);
    const next = { ...user, balance, updatedAt: new Date().toISOString() };
    this.users.set(userId, next);
    return next;
  }

  async listUsers(filter = {}) {
    return [...this.users.values()].filter((user) => {
      if (filter.onlyActive && !user.isActive) {
        return false;
      }

      if (filter.onlyDeliverable && !user.lastKnownChatId) {
        return false;
      }

      return true;
    });
  }

  async countUsers(filter = {}) {
    const users = await this.listUsers({});

    if (!filter.role) {
      return users.length;
    }

    return users.filter((user) => user.role === filter.role).length;
  }
}

class InMemoryTransactionRepository {
  constructor() {
    this.transactions = [];
  }

  async createOrGetTransaction(transaction) {
    if (transaction.idempotencyKey) {
      const existing = this.transactions.find(
        (item) =>
          item.userId === transaction.userId &&
          item.idempotencyKey === transaction.idempotencyKey
      );

      if (existing) {
        return {
          duplicate: true,
          transaction: existing
        };
      }
    }

    const created = await this.createTransaction(transaction);
    return {
      duplicate: false,
      transaction: created
    };
  }

  async findByIdempotencyKey(userId, idempotencyKey) {
    return this.transactions.find(
      (transaction) => transaction.userId === userId && transaction.idempotencyKey === idempotencyKey
    ) || null;
  }

  async createTransaction(transaction) {
    const createdAt = new Date().toISOString();
    const created = {
      ...transaction,
      _id: String(this.transactions.length + 1),
      transactionAt: transaction.transactionAt || createdAt,
      createdAt,
      updatedAt: createdAt
    };
    this.transactions.push(created);
    return created;
  }

  async getBalanceForUser(userId) {
    const balances = await this.getBalancesByUserIds([userId]);
    return balances[userId] || 0;
  }

  async getBalancesByUserIds(userIds = []) {
    const normalizedUserIds = [...new Set(userIds.filter(Boolean))];

    return this.transactions.reduce((result, transaction) => {
      if (!normalizedUserIds.includes(transaction.userId)) {
        return result;
      }

      const delta = transaction.type === "income" ? transaction.amount : -transaction.amount;
      result[transaction.userId] = (result[transaction.userId] || 0) + delta;
      return result;
    }, {});
  }

  async listTransactions(filter = {}) {
    let items = [...this.transactions];

    if (filter.userId) {
      items = items.filter((item) => item.userId === filter.userId);
    }

    if (filter.type) {
      items = items.filter((item) => item.type === filter.type);
    }

    if (filter.category) {
      items = items.filter((item) => item.category === filter.category);
    }

    if (filter.monthKey) {
      items = items.filter((item) => item.monthKey === filter.monthKey);
    }

    if (filter.dateKey) {
      items = items.filter((item) => item.dateKey === filter.dateKey);
    }

    if (filter.fromDateKey) {
      items = items.filter((item) => item.dateKey >= filter.fromDateKey);
    }

    if (filter.toDateKey) {
      items = items.filter((item) => item.dateKey <= filter.toDateKey);
    }

    items.sort((a, b) => {
      const transactionAtDelta = new Date(b.transactionAt || b.createdAt) - new Date(a.transactionAt || a.createdAt);

      if (transactionAtDelta !== 0) {
        return transactionAtDelta;
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (filter.disablePagination === true) {
      return items;
    }

    const page = Number(filter.page || 1);
    const limit = Number(filter.limit || 20);
    const start = (page - 1) * limit;
    return items.slice(start, start + limit);
  }

  async countTransactions(filter = {}) {
    const items = await this.listTransactions({ ...filter, disablePagination: true });
    return items.length;
  }

  async findByIdForUser(transactionId, userId) {
    return this.transactions.find((item) => item._id === transactionId && item.userId === userId) || null;
  }

  async updateTransaction(transactionId, userId, updates) {
    const index = this.transactions.findIndex((item) => item._id === transactionId && item.userId === userId);

    if (index < 0) {
      return null;
    }

    const next = {
      ...this.transactions[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.transactions[index] = next;
    return next;
  }

  async deleteTransaction(transactionId, userId) {
    const index = this.transactions.findIndex((item) => item._id === transactionId && item.userId === userId);

    if (index < 0) {
      return null;
    }

    const [deleted] = this.transactions.splice(index, 1);
    return deleted;
  }

  async deleteByUserId(userId) {
    this.transactions = this.transactions.filter((item) => item.userId !== userId);
    return { acknowledged: true };
  }
}

class InMemoryDeliveryJobRepository {
  constructor() {
    this.jobs = [];
  }

  async createOrGetJob(job) {
    const existing = this.jobs.find(
      (item) =>
        item.userId === job.userId &&
        item.reportType === job.reportType &&
        item.periodKey === job.periodKey &&
        item.channel === job.channel
    );

    if (existing) {
      return existing;
    }

    const created = {
      ...job,
      _id: String(this.jobs.length + 1),
      status: job.status || "pending",
      attempts: job.attempts || 0,
      nextRetryAt: job.nextRetryAt || new Date()
    };
    this.jobs.push(created);
    return created;
  }

  async findDueJobs(limit = 20) {
    return this.jobs
      .filter((job) => (
        job.status === "pending" &&
        new Date(job.nextRetryAt) <= new Date() &&
        Number(job.attempts || 0) < Number(job.maxAttempts || 0)
      ))
      .slice(0, limit);
  }

  async markProcessing(id) {
    const job = this.jobs.find((item) => item._id === id);

    if (!job) {
      return null;
    }

    if (
      job.status !== "pending" ||
      new Date(job.nextRetryAt) > new Date() ||
      Number(job.attempts || 0) >= Number(job.maxAttempts || 0)
    ) {
      return null;
    }

    job.status = "processing";
    return job;
  }

  async markCompleted(id) {
    const job = this.jobs.find((item) => item._id === id);
    job.status = "completed";
    job.lastError = null;
    return job;
  }

  async markRetry(id, attempts, nextRetryAt, lastError, maxAttempts) {
    const job = this.jobs.find((item) => item._id === id);
    job.attempts = attempts;
    job.nextRetryAt = nextRetryAt;
    job.lastError = lastError;
    job.status = attempts >= maxAttempts ? "failed" : "pending";
    return job;
  }
}

module.exports = {
  InMemoryDeliveryJobRepository,
  InMemoryTransactionRepository,
  InMemoryUserRepository
};
