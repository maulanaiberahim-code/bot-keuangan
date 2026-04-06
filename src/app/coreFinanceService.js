const AppError = require("../errors/AppError");
const env = require("../config/env");
const { getCurrentDayKey, getCurrentMonthKey, getLocalDateParts, isValidDayKey, isValidMonthKey } = require("../utils/dateHelper");
const { parseAmount } = require("../utils/amount");

class CoreFinanceService {
  constructor({ userRepository, transactionRepository, deliveryJobRepository, logger, adminUserIds = env.adminUserIds }) {
    this.userRepository = userRepository;
    this.transactionRepository = transactionRepository;
    this.deliveryJobRepository = deliveryJobRepository;
    this.logger = logger;
    this.adminUserIds = new Set(adminUserIds);
  }

  async createTransaction(input) {
    const userId = this.normalizeUserId(input.userId);
    const amount = this.normalizeAmount(input.amount);
    const category = this.normalizeCategory(input.category);
    const type = input.type;
    const idempotencyKey = input.idempotencyKey || null;

    if (!["income", "expense"].includes(type)) {
      throw new AppError("Jenis transaksinya belum pas. Pakai masuk atau keluar ya.", 400, "INVALID_TRANSACTION_TYPE");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Nominalnya belum valid. Masukkan angka lebih dari 0 ya.", 400, "INVALID_AMOUNT");
    }

    if (!category) {
      throw new AppError("Kategorinya jangan kosong ya.", 400, "CATEGORY_REQUIRED");
    }

    const transactionAt = this.resolveTransactionAt(input.transactionDate);

    await this.ensureUserContext({
      userId,
      chatId: input.chatId
    });

    const { dateKey, monthKey } = getLocalDateParts(transactionAt);

    const creationResult = await this.transactionRepository.createOrGetTransaction({
      userId,
      type,
      amount,
      category,
      source: input.source || "api",
      chatId: input.chatId || null,
      correlationId: input.correlationId || null,
      transactionAt,
      idempotencyKey,
      dateKey,
      monthKey
    });

    let balance = null;

    if (!creationResult.duplicate) {
      try {
        const balanceAfter = await this.userRepository.incrementBalance(
          userId,
          type === "income" ? amount : -amount
        );
        balance = balanceAfter.balance;
      } catch (error) {
        this.logger.error("user_balance_cache_update_failed", {
          userId,
          transactionId: creationResult.transaction?._id || null,
          correlationId: input.correlationId || null,
          error: error.message,
          stack: error.stack
        });
      }
    }

    return {
      duplicate: creationResult.duplicate,
      transaction: creationResult.transaction,
      balance: balance ?? await this.getCurrentBalance(userId)
    };
  }

  async getTransactions(filter) {
    const userId = this.normalizeUserId(filter.userId);

    await this.getUserContext({
      userId,
      chatId: filter.chatId || null,
      touchIfExists: true
    });

    const normalizedFilter = this.buildTransactionFilter({
      ...filter,
      userId
    });
    const [items, totalItems] = await Promise.all([
      this.transactionRepository.listTransactions(normalizedFilter),
      this.transactionRepository.countTransactions(normalizedFilter)
    ]);

    const page = Number(normalizedFilter.page || 1);
    const limit = Number(normalizedFilter.limit || 20);

    return {
      items,
      filters: normalizedFilter,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: limit > 0 ? Math.ceil(totalItems / limit) : 1
      }
    };
  }

  async getTransactionDetail({ userId, transactionId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const normalizedTransactionId = this.normalizeTransactionId(transactionId);

    await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    const transaction = await this.transactionRepository.findByIdForUser(
      normalizedTransactionId,
      normalizedUserId
    );

    if (!transaction) {
      throw new AppError("Transaksinya tidak ketemu untuk user ini.", 404, "TRANSACTION_NOT_FOUND");
    }

    return {
      transaction,
      balance: await this.getCurrentBalance(normalizedUserId)
    };
  }

  async requestTransactionDeletion({ userId, transactionId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const normalizedTransactionId = this.normalizeTransactionId(transactionId);

    await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    const transaction = await this.transactionRepository.findByIdForUser(
      normalizedTransactionId,
      normalizedUserId
    );

    if (!transaction) {
      throw new AppError("Transaksinya tidak ketemu untuk user ini.", 404, "TRANSACTION_NOT_FOUND");
    }

    if (typeof this.userRepository.setPendingDeleteTransactionId === "function") {
      await this.userRepository.setPendingDeleteTransactionId(normalizedUserId, normalizedTransactionId);
    }

    return {
      status: "pending_confirmation",
      transaction
    };
  }

  async confirmTransactionDeletion({ userId, transactionId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const normalizedTransactionId = this.normalizeTransactionId(transactionId);
    const user = await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    if (user.pendingDeleteTransactionId !== normalizedTransactionId) {
      return {
        status: "noop",
        message: `Belum ada permintaan hapus untuk transaksi ${normalizedTransactionId}. Kirim \`hapus ${normalizedTransactionId}\` dulu ya.`
      };
    }

    const transaction = await this.transactionRepository.deleteTransaction(normalizedTransactionId, normalizedUserId);

    if (!transaction) {
      if (typeof this.userRepository.setPendingDeleteTransactionId === "function") {
        await this.userRepository.setPendingDeleteTransactionId(normalizedUserId, null);
      }

      return {
        status: "noop",
        message: "Transaksinya sudah tidak ada, jadi tidak perlu dihapus lagi."
      };
    }

    if (typeof this.userRepository.setPendingDeleteTransactionId === "function") {
      await this.userRepository.setPendingDeleteTransactionId(normalizedUserId, null);
    }

    const balance = await this.syncUserBalance(normalizedUserId);

    return {
      status: "completed",
      transaction,
      balance
    };
  }

  async updateTransaction(input) {
    const userId = this.normalizeUserId(input.userId);
    const transactionId = this.normalizeTransactionId(input.transactionId);

    await this.getUserContext({
      userId,
      chatId: input.chatId || null,
      touchIfExists: true
    });

    const existingTransaction = await this.transactionRepository.findByIdForUser(transactionId, userId);

    if (!existingTransaction) {
      throw new AppError("Transaksinya tidak ketemu untuk user ini.", 404, "TRANSACTION_NOT_FOUND");
    }

    const updates = this.buildTransactionUpdates(input, existingTransaction);

    if (!Object.keys(updates).length) {
      throw new AppError("Minimal ada satu data transaksi yang diubah ya.", 400, "TRANSACTION_UPDATE_REQUIRED");
    }

    const transaction = await this.transactionRepository.updateTransaction(transactionId, userId, updates);
    const balance = await this.syncUserBalance(userId);

    return {
      transaction,
      balance
    };
  }

  async deleteTransaction({ userId, transactionId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const normalizedTransactionId = this.normalizeTransactionId(transactionId);

    await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    const transaction = await this.transactionRepository.deleteTransaction(normalizedTransactionId, normalizedUserId);

    if (!transaction) {
      throw new AppError("Transaksinya tidak ketemu untuk user ini.", 404, "TRANSACTION_NOT_FOUND");
    }

    const balance = await this.syncUserBalance(normalizedUserId);

    return {
      transaction,
      balance
    };
  }

  async getSummary({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const user = await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });
    const [allTransactions, currentMonthTransactions] = await Promise.all([
      this.transactionRepository.listTransactions({
        userId: normalizedUserId,
        disablePagination: true
      }),
      this.transactionRepository.listTransactions({
        userId: normalizedUserId,
        monthKey: getCurrentMonthKey(),
        disablePagination: true
      })
    ]);

    return {
      userId: normalizedUserId,
      balance: this.calculateBalanceFromTransactions(allTransactions),
      role: user.role,
      stats: {
        totalTransactions: currentMonthTransactions.length,
        currentMonthIncome: this.sumTransactions(currentMonthTransactions, "income"),
        currentMonthExpense: this.sumTransactions(currentMonthTransactions, "expense")
      }
    };
  }

  async getMonthlyReport({ userId, monthKey, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const normalizedMonthKey = monthKey || getCurrentMonthKey();

    if (!isValidMonthKey(normalizedMonthKey)) {
      throw new AppError("Format bulannya belum pas. Pakai YYYY-MM, misalnya 2026-04.", 400, "INVALID_MONTH");
    }

    await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    const transactions = await this.transactionRepository.listTransactions({
      userId: normalizedUserId,
      monthKey: normalizedMonthKey,
      disablePagination: true
    });

    const incomeTransactions = transactions.filter((item) => item.type === "income");
    const expenseTransactions = transactions.filter((item) => item.type === "expense");
    const incomeBreakdown = this.buildBreakdown(incomeTransactions);
    const expenseBreakdown = this.buildBreakdown(expenseTransactions);

    return {
      userId: normalizedUserId,
      month: normalizedMonthKey,
      totals: {
        income: this.sumTransactions(incomeTransactions, "income"),
        expense: this.sumTransactions(expenseTransactions, "expense"),
        net: this.sumTransactions(incomeTransactions, "income") - this.sumTransactions(expenseTransactions, "expense"),
        transactionCount: transactions.length
      },
      incomeBreakdown,
      expenseBreakdown,
      insights: {
        topIncomeCategory: incomeBreakdown[0] || null,
        topExpenseCategory: expenseBreakdown[0] || null
      }
    };
  }

  async getChartData({ userId, monthKey, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const normalizedMonthKey = monthKey || getCurrentMonthKey();
    await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    const transactions = await this.transactionRepository.listTransactions({
      userId: normalizedUserId,
      monthKey: normalizedMonthKey,
      disablePagination: true
    });

    const pointMap = transactions.reduce((accumulator, transaction) => {
      const current = accumulator[transaction.dateKey] || {
        date: transaction.dateKey,
        income: 0,
        expense: 0
      };

      if (transaction.type === "income") {
        current.income += transaction.amount;
      } else {
        current.expense += transaction.amount;
      }

      accumulator[transaction.dateKey] = current;
      return accumulator;
    }, {});

    return {
      userId: normalizedUserId,
      month: normalizedMonthKey,
      points: Object.values(pointMap).sort((a, b) => a.date.localeCompare(b.date))
    };
  }

  async getCategoryBreakdown({ userId, monthKey, type, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const normalizedMonthKey = monthKey || getCurrentMonthKey();
    await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    const transactions = await this.transactionRepository.listTransactions({
      userId: normalizedUserId,
      monthKey: normalizedMonthKey,
      type: type || undefined,
      disablePagination: true
    });

    return {
      userId: normalizedUserId,
      month: normalizedMonthKey,
      type: type || "all",
      items: this.buildBreakdown(transactions)
    };
  }

  async requestReset({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    await this.ensureUserContext({ userId: normalizedUserId, chatId });
    await this.userRepository.setPendingReset(normalizedUserId, true);

    return {
      status: "pending_confirmation",
      message: 'Kalau kamu yakin, balas "ya reset". Kalau belum jadi, balas "batal reset".'
    };
  }

  async confirmReset({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const user = await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    if (!user.pendingReset) {
      return {
        status: "noop",
        message: "Belum ada reset yang menunggu konfirmasi."
      };
    }

    await this.transactionRepository.deleteByUserId(normalizedUserId);

    try {
      await this.userRepository.resetUserState(normalizedUserId);
    } catch (error) {
      this.logger.error("user_reset_cache_update_failed", {
        userId: normalizedUserId,
        error: error.message,
        stack: error.stack
      });
    }

    return {
      status: "completed",
      message: "Siap, semua catatan keuanganmu sudah direset."
    };
  }

  async cancelReset({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const user = await this.getUserContext({
      userId: normalizedUserId,
      chatId,
      touchIfExists: true
    });

    if (!user.pendingReset) {
      return {
        status: "noop",
        message: "Belum ada reset yang perlu dibatalkan."
      };
    }

    await this.userRepository.setPendingReset(normalizedUserId, false);

    return {
      status: "cancelled",
      message: "Oke, reset dibatalkan."
    };
  }

  async getGlobalStats({ monthKey }) {
    const normalizedMonthKey = monthKey || getCurrentMonthKey();
    const [users, transactions] = await Promise.all([
      this.userRepository.listUsers({ onlyActive: false }),
      this.transactionRepository.listTransactions({
        monthKey: normalizedMonthKey,
        disablePagination: true
      })
    ]);

    return {
      month: normalizedMonthKey,
      totals: {
        users: users.length,
        admins: users.filter((user) => user.role === "admin").length,
        transactions: transactions.length,
        transactionVolume: transactions.reduce((sum, item) => sum + item.amount, 0)
      }
    };
  }

  async getTopCategories({ monthKey, type, limit = 5 }) {
    const normalizedMonthKey = monthKey || getCurrentMonthKey();
    const transactions = await this.transactionRepository.listTransactions({
      monthKey: normalizedMonthKey,
      type: type || undefined,
      disablePagination: true
    });

    return {
      month: normalizedMonthKey,
      type: type || "all",
      items: this.buildBreakdown(transactions).slice(0, Number(limit))
    };
  }

  async getMostActiveUsers({ monthKey, limit = 5 }) {
    const normalizedMonthKey = monthKey || getCurrentMonthKey();
    const [users, transactions] = await Promise.all([
      this.userRepository.listUsers({ onlyActive: true }),
      this.transactionRepository.listTransactions({
        monthKey: normalizedMonthKey,
        disablePagination: true
      })
    ]);

    const perUser = transactions.reduce((accumulator, transaction) => {
      const current = accumulator[transaction.userId] || {
        userId: transaction.userId,
        transactionCount: 0
      };
      current.transactionCount += 1;
      accumulator[transaction.userId] = current;
      return accumulator;
    }, {});

    const topUsers = Object.values(perUser)
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, Number(limit));
    const balanceByUserId = await this.transactionRepository.getBalancesByUserIds(
      topUsers.map((item) => item.userId)
    );

    return {
      month: normalizedMonthKey,
      items: topUsers.map((item) => {
        const user = users.find((entry) => entry.userId === item.userId);

        return {
          ...item,
          balance: balanceByUserId[item.userId] ?? user?.balance ?? 0,
          role: user ? user.role : this.getUserRole(item.userId)
        };
      })
    };
  }

  async queueScheduledReport({ userId, chatId, reportType, periodKey, payload }) {
    return this.deliveryJobRepository.createOrGetJob({
      userId,
      chatId,
      channel: "whatsapp",
      reportType,
      periodKey,
      payload,
      maxAttempts: env.schedulerMaxAttempts,
      status: "pending",
      attempts: 0,
      nextRetryAt: new Date()
    });
  }

  async getDeliverableUsers() {
    return this.userRepository.listUsers({
      onlyActive: true,
      onlyDeliverable: true
    });
  }

  async getExportTransactions(filter) {
    const userId = this.normalizeUserId(filter.userId);

    await this.getUserContext({
      userId,
      chatId: filter.chatId || null,
      touchIfExists: false
    });

    const normalizedFilter = {
      ...this.buildTransactionFilter({
        ...filter,
        userId
      }),
      disablePagination: true
    };

    return this.transactionRepository.listTransactions(normalizedFilter);
  }

  async ensureAdminAccess(userId) {
    const user = await this.getUserContext({
      userId: this.normalizeUserId(userId)
    });

    if (user.role !== "admin") {
      throw new AppError("Fitur ini khusus admin ya.", 403, "FORBIDDEN_ADMIN_ONLY");
    }

    return user;
  }

  buildTransactionFilter(filter) {
    const normalized = {
      userId: this.normalizeUserId(filter.userId),
      page: Number(filter.page || 1),
      limit: Number(filter.limit || 20)
    };

    if (filter.category) {
      normalized.category = this.normalizeCategory(filter.category);
    }

    if (filter.type) {
      normalized.type = filter.type;
    }

    if (filter.period === "today") {
      normalized.dateKey = getCurrentDayKey();
    }

    if (filter.period === "month") {
      normalized.monthKey = getCurrentMonthKey();
    }

    if (filter.monthKey) {
      normalized.monthKey = filter.monthKey;
    }

    if (filter.fromDateKey) {
      if (!isValidDayKey(filter.fromDateKey)) {
        throw new AppError("Format tanggal awal harus YYYY-MM-DD ya.", 400, "INVALID_DATE_RANGE");
      }

      normalized.fromDateKey = filter.fromDateKey;
    }

    if (filter.toDateKey) {
      if (!isValidDayKey(filter.toDateKey)) {
        throw new AppError("Format tanggal akhir harus YYYY-MM-DD ya.", 400, "INVALID_DATE_RANGE");
      }

      normalized.toDateKey = filter.toDateKey;
    }

    if (
      normalized.fromDateKey &&
      normalized.toDateKey &&
      normalized.fromDateKey > normalized.toDateKey
    ) {
      throw new AppError("Tanggal awal tidak boleh lebih besar dari tanggal akhir.", 400, "INVALID_DATE_RANGE");
    }

    return normalized;
  }

  buildTransactionUpdates(input, existingTransaction) {
    const updates = {};

    if (input.type !== undefined) {
      if (!["income", "expense"].includes(input.type)) {
        throw new AppError("Jenis transaksinya belum pas. Pakai masuk atau keluar ya.", 400, "INVALID_TRANSACTION_TYPE");
      }

      updates.type = input.type;
    }

    if (input.amount !== undefined) {
      const amount = this.normalizeAmount(input.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError("Nominalnya belum valid. Masukkan angka lebih dari 0 ya.", 400, "INVALID_AMOUNT");
      }

      updates.amount = amount;
    }

    if (input.category !== undefined) {
      const category = this.normalizeCategory(input.category);

      if (!category) {
        throw new AppError("Kategorinya jangan kosong ya.", 400, "CATEGORY_REQUIRED");
      }

      updates.category = category;
    }

    if (input.transactionDate !== undefined) {
      const transactionAt = this.resolveTransactionAt(input.transactionDate);
      const { dateKey, monthKey } = getLocalDateParts(transactionAt);

      updates.transactionAt = transactionAt;
      updates.dateKey = dateKey;
      updates.monthKey = monthKey;
    }

    if (
      updates.type === undefined &&
      updates.amount === undefined &&
      updates.category === undefined &&
      updates.transactionAt === undefined
    ) {
      return {};
    }

    return {
      type: updates.type ?? existingTransaction.type,
      amount: updates.amount ?? existingTransaction.amount,
      category: updates.category ?? existingTransaction.category,
      transactionAt: updates.transactionAt ?? existingTransaction.transactionAt,
      dateKey: updates.dateKey ?? existingTransaction.dateKey,
      monthKey: updates.monthKey ?? existingTransaction.monthKey
    };
  }

  buildBreakdown(transactions) {
    const map = transactions.reduce((accumulator, transaction) => {
      const current = accumulator[transaction.category] || {
        category: transaction.category,
        amount: 0,
        count: 0
      };

      current.amount += transaction.amount;
      current.count += 1;
      accumulator[transaction.category] = current;
      return accumulator;
    }, {});

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }

  sumTransactions(transactions, type) {
    return transactions
      .filter((item) => item.type === type)
      .reduce((sum, item) => sum + item.amount, 0);
  }

  calculateBalanceFromTransactions(transactions) {
    return transactions.reduce((sum, item) => (
      sum + (item.type === "income" ? item.amount : -item.amount)
    ), 0);
  }

  async getCurrentBalance(userId) {
    return this.transactionRepository.getBalanceForUser(userId);
  }

  async getUserContext({ userId, chatId = null, touchIfExists = false }) {
    const normalizedUserId = this.normalizeUserId(userId);

    if (!normalizedUserId) {
      throw new AppError("User belum dikenali. Coba kirim pesan lagi ya.", 400, "USER_ID_REQUIRED");
    }

    const existingUser = await this.userRepository.findByUserId(normalizedUserId);

    if (!existingUser) {
      return this.buildDefaultUserContext(normalizedUserId);
    }

    if (!touchIfExists || typeof this.userRepository.touchContext !== "function") {
      return existingUser;
    }

    const touchedUser = await this.userRepository.touchContext({
      userId: normalizedUserId,
      chatId
    });

    return touchedUser || existingUser;
  }

  async ensureUserContext({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);

    if (!normalizedUserId) {
      throw new AppError("User belum dikenali. Coba kirim pesan lagi ya.", 400, "USER_ID_REQUIRED");
    }

    const existingUser = await this.userRepository.findByUserId(normalizedUserId);

    if (existingUser) {
      if (typeof this.userRepository.touchContext !== "function") {
        return existingUser;
      }

      const touchedUser = await this.userRepository.touchContext({
        userId: normalizedUserId,
        chatId
      });

      return touchedUser || existingUser;
    }

    return this.userRepository.upsertContext({
      userId: normalizedUserId,
      chatId
    });
  }

  buildDefaultUserContext(userId) {
    return {
      userId,
      role: this.getUserRole(userId),
      balance: 0,
      pendingReset: false,
      pendingDeleteTransactionId: null,
      timezone: env.timezone,
      preferredChannel: "whatsapp",
      lastKnownChatId: null,
      lastInteractionAt: null,
      isActive: false
    };
  }

  getUserRole(userId) {
    return this.adminUserIds.has(userId) ? "admin" : "user";
  }

  normalizeUserId(userId) {
    return String(userId || "").replace(/[^\d]/g, "").trim();
  }

  normalizeCategory(category) {
    return String(category || "").trim().toLowerCase();
  }

  normalizeAmount(amount) {
    return parseAmount(amount);
  }

  normalizeTransactionId(transactionId) {
    const normalizedTransactionId = String(transactionId || "").trim();

    if (!normalizedTransactionId) {
      throw new AppError("ID transaksi wajib diisi ya.", 400, "TRANSACTION_ID_REQUIRED");
    }

    return normalizedTransactionId;
  }

  async syncUserBalance(userId) {
    const balance = await this.getCurrentBalance(userId);

    try {
      if (typeof this.userRepository.setBalance === "function") {
        await this.userRepository.setBalance(userId, balance);
      }
    } catch (error) {
      this.logger.error("user_balance_cache_sync_failed", {
        userId,
        error: error.message,
        stack: error.stack
      });
    }

    return balance;
  }

  resolveTransactionAt(transactionDate) {
    if (!transactionDate) {
      return new Date().toISOString();
    }

    if (!isValidDayKey(transactionDate)) {
      throw new AppError("Format tanggal transaksi harus YYYY-MM-DD ya.", 400, "INVALID_TRANSACTION_DATE");
    }

    if (transactionDate > getCurrentDayKey()) {
      throw new AppError("Tanggal transaksi tidak boleh lebih dari hari ini.", 400, "INVALID_TRANSACTION_DATE");
    }

    return `${transactionDate}T05:00:00.000Z`;
  }
}

module.exports = CoreFinanceService;
