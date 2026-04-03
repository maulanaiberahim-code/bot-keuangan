const AppError = require("../errors/AppError");
const env = require("../config/env");
const { getCurrentDayKey, getCurrentMonthKey, getLocalDateParts, isValidMonthKey } = require("../utils/dateHelper");
const { parseAmount } = require("../utils/amount");

class CoreFinanceService {
  constructor({ userRepository, transactionRepository, deliveryJobRepository, logger }) {
    this.userRepository = userRepository;
    this.transactionRepository = transactionRepository;
    this.deliveryJobRepository = deliveryJobRepository;
    this.logger = logger;
  }

  async createTransaction(input) {
    const userId = this.normalizeUserId(input.userId);
    const amount = this.normalizeAmount(input.amount);
    const category = this.normalizeCategory(input.category);
    const type = input.type;
    const idempotencyKey = input.idempotencyKey || null;

    if (!["income", "expense"].includes(type)) {
      throw new AppError("Type transaksi harus income atau expense.", 400, "INVALID_TRANSACTION_TYPE");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Nominal harus berupa angka lebih dari 0.", 400, "INVALID_AMOUNT");
    }

    if (!category) {
      throw new AppError("Kategori transaksi wajib diisi.", 400, "CATEGORY_REQUIRED");
    }

    const user = await this.ensureUserContext({
      userId,
      chatId: input.chatId
    });

    const createdAt = new Date().toISOString();
    const { dateKey, monthKey } = getLocalDateParts(createdAt);

    const creationResult = await this.transactionRepository.createOrGetTransaction({
      userId,
      type,
      amount,
      category,
      source: input.source || "api",
      chatId: input.chatId || null,
      correlationId: input.correlationId || null,
      idempotencyKey,
      dateKey,
      monthKey,
      createdAt
    });

    if (creationResult.duplicate) {
      const currentUser = await this.userRepository.findByUserId(userId);

      return {
        duplicate: true,
        transaction: creationResult.transaction,
        balance: currentUser ? currentUser.balance : user.balance
      };
    }

    const balanceAfter = await this.userRepository.incrementBalance(
      userId,
      type === "income" ? amount : -amount
    );

    return {
      duplicate: false,
      transaction: creationResult.transaction,
      balance: balanceAfter.balance
    };
  }

  async getTransactions(filter) {
    const userId = this.normalizeUserId(filter.userId);

    await this.ensureUserContext({
      userId,
      chatId: filter.chatId || null
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

  async getSummary({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const user = await this.ensureUserContext({ userId: normalizedUserId, chatId });
    const currentMonthTransactions = await this.transactionRepository.listTransactions({
      userId: normalizedUserId,
      monthKey: getCurrentMonthKey(),
      disablePagination: true
    });

    return {
      userId: normalizedUserId,
      balance: user.balance,
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
      throw new AppError("Format bulan harus YYYY-MM, contoh: 2026-04.", 400, "INVALID_MONTH");
    }

    await this.ensureUserContext({ userId: normalizedUserId, chatId });

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
    await this.ensureUserContext({ userId: normalizedUserId, chatId });

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
    await this.ensureUserContext({ userId: normalizedUserId, chatId });

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
      message: 'Ketik "ya reset" untuk konfirmasi atau "batal reset" untuk membatalkan.'
    };
  }

  async confirmReset({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const user = await this.ensureUserContext({ userId: normalizedUserId, chatId });

    if (!user.pendingReset) {
      return {
        status: "noop",
        message: "Tidak ada reset yang menunggu konfirmasi."
      };
    }

    await this.transactionRepository.deleteByUserId(normalizedUserId);
    await this.userRepository.resetUserState(normalizedUserId);

    return {
      status: "completed",
      message: "Data keuangan berhasil direset."
    };
  }

  async cancelReset({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);
    const user = await this.ensureUserContext({ userId: normalizedUserId, chatId });

    if (!user.pendingReset) {
      return {
        status: "noop",
        message: "Tidak ada reset yang perlu dibatalkan."
      };
    }

    await this.userRepository.setPendingReset(normalizedUserId, false);

    return {
      status: "cancelled",
      message: "Reset dibatalkan."
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

    return {
      month: normalizedMonthKey,
      items: Object.values(perUser)
        .map((item) => {
          const user = users.find((entry) => entry.userId === item.userId);
          return {
            ...item,
            balance: user ? user.balance : 0,
            role: user ? user.role : "user"
          };
        })
        .sort((a, b) => b.transactionCount - a.transactionCount)
        .slice(0, Number(limit))
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

    await this.ensureUserContext({
      userId,
      chatId: filter.chatId || null
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
    const user = await this.ensureUserContext({
      userId: this.normalizeUserId(userId)
    });

    if (user.role !== "admin") {
      throw new AppError("Akses admin diperlukan.", 403, "FORBIDDEN_ADMIN_ONLY");
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
      normalized.fromDateKey = filter.fromDateKey;
    }

    if (filter.toDateKey) {
      normalized.toDateKey = filter.toDateKey;
    }

    return normalized;
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

  async ensureUserContext({ userId, chatId = null }) {
    const normalizedUserId = this.normalizeUserId(userId);

    if (!normalizedUserId) {
      throw new AppError("userId wajib diisi.", 400, "USER_ID_REQUIRED");
    }

    return this.userRepository.upsertContext({
      userId: normalizedUserId,
      chatId
    });
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
}

module.exports = CoreFinanceService;
