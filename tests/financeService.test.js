const FinanceService = require("../src/services/financeService");

class InMemoryRepository {
  constructor() {
    this.users = {};
  }

  getState(userId) {
    if (!this.users[userId]) {
      this.users[userId] = {
        balance: 0,
        transactions: [],
        pendingReset: false,
        sequence: 0
      };
    }

    return this.users[userId];
  }

  appendTransaction(userId, transactionInput) {
    const state = this.getState(userId);
    state.sequence += 1;
    state.transactions.push({ id: state.sequence, ...transactionInput });
    state.balance += transactionInput.type === "income"
      ? transactionInput.amount
      : -transactionInput.amount;
    state.pendingReset = false;
    return state;
  }

  getBalance(userId) {
    return this.getState(userId).balance;
  }

  getTransactions(userId) {
    return [...this.getState(userId).transactions].sort((a, b) => b.id - a.id);
  }

  markResetPending(userId) {
    this.getState(userId).pendingReset = true;
  }

  clearResetPending(userId) {
    this.getState(userId).pendingReset = false;
  }

  isResetPending(userId) {
    return this.getState(userId).pendingReset;
  }

  resetUser(userId) {
    this.users[userId] = {
      balance: 0,
      transactions: [],
      pendingReset: false,
      sequence: 0
    };
    return this.users[userId];
  }
}

describe("FinanceService", () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = new InMemoryRepository();
    service = new FinanceService(repository);
  });

  test("mencatat transaksi pemasukan dan menambah saldo user", () => {
    const result = service.addIncome("628111", 50000, "gaji");

    expect(result.balance).toBe(50000);
    expect(result.latestTransaction.category).toBe("gaji");
    expect(service.getBalance("628111")).toBe(50000);
  });

  test("menerima nominal dengan separator ribuan yang umum di chat", () => {
    const result = service.addIncome("628111", "50.000", "gaji");

    expect(result.balance).toBe(50000);
    expect(service.getBalance("628111")).toBe(50000);
  });

  test("mencatat transaksi pengeluaran dan mengurangi saldo user", () => {
    service.addIncome("628111", 50000, "gaji");
    const result = service.addExpense("628111", 20000, "makan");

    expect(result.balance).toBe(30000);
    expect(result.latestTransaction.type).toBe("expense");
  });

  test("laporan bulanan menghitung total dan breakdown kategori", () => {
    service.addIncome("628111", 100000, "gaji");
    service.addIncome("628111", 50000, "bonus");
    service.addExpense("628111", 25000, "makan");
    service.addExpense("628111", 15000, "transport");

    const report = service.getMonthlyReportMessage("628111");

    expect(report).toContain("Total pemasukan");
    expect(report).toContain("Pemasukan per kategori");
    expect(report).toContain("Pengeluaran per kategori");
    expect(report).toContain("gaji");
    expect(report).toContain("bonus");
    expect(report).toContain("makan");
    expect(report).toContain("transport");
  });

  test("riwayat kategori hanya menampilkan transaksi pada kategori yang dipilih", () => {
    service.addIncome("628111", 100000, "gaji");
    service.addExpense("628111", 20000, "makan");
    service.addExpense("628111", 10000, "transport");

    const history = service.getHistoryMessage("628111", {
      type: "category",
      category: "makan"
    });

    expect(history).toContain("kategori makan");
    expect(history).toContain("makan");
    expect(history).not.toContain("transport");
  });

  test("data antar user terpisah dan tidak bocor", () => {
    service.addIncome("628111", 100000, "gaji");
    service.addIncome("628222", 50000, "bonus");

    expect(service.getBalance("628111")).toBe(100000);
    expect(service.getBalance("628222")).toBe(50000);
    expect(service.getHistoryMessage("628111")).not.toContain("bonus");
  });

  test("melempar error saat nominal tidak valid", () => {
    expect(() => service.addExpense("628111", 0, "makan")).toThrow(
      "Nominal harus berupa angka lebih dari 0."
    );
  });
});
