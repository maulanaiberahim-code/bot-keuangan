const TransactionRepository = require("../repositories/transactionRepository");
const AppError = require("../errors/AppError");
const {
  formatCategoryBreakdown,
  formatCurrency,
  formatTransaction
} = require("../utils/formatter");
const {
  getCurrentDayKey,
  getCurrentMonthKey,
  isValidMonthKey,
  matchesDay,
  matchesMonth
} = require("../utils/dateHelper");

class FinanceService {
  constructor(repository = new TransactionRepository()) {
    this.repository = repository;
  }

  addIncome(userId, amount, category) {
    return this.addTransaction(userId, "income", amount, category);
  }

  addExpense(userId, amount, category) {
    return this.addTransaction(userId, "expense", amount, category);
  }

  addTransaction(userId, type, amount, category) {
    const normalizedAmount = this.normalizeAmount(amount);
    const normalizedCategory = String(category || "").trim().toLowerCase();

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new AppError("Nominal harus berupa angka lebih dari 0.", 400, "INVALID_AMOUNT");
    }

    if (!normalizedCategory) {
      throw new AppError("Kategori transaksi wajib diisi.", 400, "CATEGORY_REQUIRED");
    }

    const state = this.repository.appendTransaction(userId, {
      type,
      amount: normalizedAmount,
      category: normalizedCategory,
      createdAt: new Date().toISOString()
    });

    return {
      balance: state.balance,
      latestTransaction: state.transactions[state.transactions.length - 1]
    };
  }

  getBalance(userId) {
    return this.repository.getBalance(userId);
  }

  getBalanceMessage(userId) {
    const balance = this.getBalance(userId);
    return `Saldo saat ini: ${formatCurrency(balance)}`;
  }

  getHistoryMessage(userId, filter = { type: "all" }) {
    const transactions = this.repository.getTransactions(userId);
    const filteredTransactions = this.filterTransactions(transactions, filter);

    if (!filteredTransactions.length) {
      return "Tidak ada transaksi yang cocok dengan filter tersebut.";
    }

    const lines = filteredTransactions.slice(0, 10).map((transaction) => formatTransaction(transaction));
    return [this.getHistoryHeader(filter), ...lines].join("\n");
  }

  getMonthlyReportMessage(userId, monthKey = getCurrentMonthKey()) {
    if (!isValidMonthKey(monthKey)) {
      throw new AppError("Format bulan harus YYYY-MM, contoh: 2026-04.", 400, "INVALID_MONTH");
    }

    const transactions = this.repository.getTransactions(userId)
      .filter((transaction) => matchesMonth(transaction.createdAt, monthKey));

    const totalIncome = transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const totalExpense = transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const incomeBreakdown = transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((accumulator, transaction) => {
        const currentValue = accumulator[transaction.category] || 0;
        accumulator[transaction.category] = currentValue + transaction.amount;
        return accumulator;
      }, {});

    const expenseBreakdown = transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((accumulator, transaction) => {
        const currentValue = accumulator[transaction.category] || 0;
        accumulator[transaction.category] = currentValue + transaction.amount;
        return accumulator;
      }, {});

    return [
      `Laporan bulan ${monthKey}:`,
      `- Total pemasukan: ${formatCurrency(totalIncome)}`,
      `- Total pengeluaran: ${formatCurrency(totalExpense)}`,
      `- Selisih: ${formatCurrency(totalIncome - totalExpense)}`,
      "",
      "Pemasukan per kategori:",
      formatCategoryBreakdown(incomeBreakdown, "Tidak ada pemasukan."),
      "",
      "Pengeluaran per kategori:",
      formatCategoryBreakdown(expenseBreakdown, "Tidak ada pengeluaran.")
    ].join("\n");
  }

  requestReset(userId) {
    this.repository.markResetPending(userId);
    return 'Ketik "ya reset" untuk konfirmasi atau "batal reset" untuk membatalkan.';
  }

  confirmReset(userId) {
    if (!this.repository.isResetPending(userId)) {
      return "Tidak ada reset yang menunggu konfirmasi.";
    }

    this.repository.resetUser(userId);
    return "Data keuangan berhasil direset.";
  }

  cancelReset(userId) {
    if (!this.repository.isResetPending(userId)) {
      return "Tidak ada reset yang perlu dibatalkan.";
    }

    this.repository.clearResetPending(userId);
    return "Reset dibatalkan.";
  }

  filterTransactions(transactions, filter) {
    switch (filter.type) {
      case "today":
        return transactions.filter((transaction) => matchesDay(transaction.createdAt, getCurrentDayKey()));
      case "month":
        return transactions.filter((transaction) => matchesMonth(transaction.createdAt, getCurrentMonthKey()));
      case "category":
        return transactions.filter(
          (transaction) => transaction.category === String(filter.category || "").trim().toLowerCase()
        );
      default:
        return transactions;
    }
  }

  getHistoryHeader(filter) {
    switch (filter.type) {
      case "today":
        return "Riwayat transaksi hari ini:";
      case "month":
        return "Riwayat transaksi bulan ini:";
      case "category":
        return `Riwayat transaksi kategori ${filter.category}:`;
      default:
        return "Riwayat transaksi terakhir:";
    }
  }

  normalizeAmount(amount) {
    if (typeof amount === "number") {
      return amount;
    }

    const digitsOnly = String(amount || "").replace(/[^\d]/g, "");
    return Number(digitsOnly);
  }
}

module.exports = FinanceService;
