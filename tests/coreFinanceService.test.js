const createAppContext = require("../src/app/createAppContext");
const {
  InMemoryDeliveryJobRepository,
  InMemoryTransactionRepository,
  InMemoryUserRepository
} = require("../src/testing/inMemoryRepositories");

class FailingBalanceUserRepository extends InMemoryUserRepository {
  async incrementBalance() {
    throw new Error("balance cache write failed");
  }
}

class SpyTransactionRepository extends InMemoryTransactionRepository {
  constructor() {
    super();
    this.balanceQueryCount = 0;
  }

  async getBalanceForUser(userId) {
    this.balanceQueryCount += 1;
    return super.getBalanceForUser(userId);
  }
}

function createNoopLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {}
  };
}

describe("CoreFinanceService", () => {
  test("tetap mengembalikan saldo akurat saat cache balance gagal diupdate", async () => {
    const context = createAppContext({
      logger: createNoopLogger(),
      serviceName: "test",
      userRepository: new FailingBalanceUserRepository(),
      transactionRepository: new InMemoryTransactionRepository(),
      deliveryJobRepository: new InMemoryDeliveryJobRepository()
    });

    const service = context.services.coreFinanceService;
    const result = await service.createTransaction({
      userId: "628111",
      type: "income",
      amount: 50000,
      category: "gaji",
      source: "api",
      idempotencyKey: "income-1"
    });

    const summary = await service.getSummary({ userId: "628111" });
    const persistedUser = await context.repositories.userRepository.findByUserId("628111");

    expect(result.balance).toBe(50000);
    expect(summary.balance).toBe(50000);
    expect(persistedUser.balance).toBe(0);
  });

  test("tidak hitung ulang saldo saat cache balance berhasil diupdate", async () => {
    const transactionRepository = new SpyTransactionRepository();
    const context = createAppContext({
      logger: createNoopLogger(),
      serviceName: "test",
      userRepository: new InMemoryUserRepository(),
      transactionRepository,
      deliveryJobRepository: new InMemoryDeliveryJobRepository()
    });

    const service = context.services.coreFinanceService;
    const result = await service.createTransaction({
      userId: "628111",
      type: "income",
      amount: 75000,
      category: "gaji",
      source: "api",
      idempotencyKey: "income-2"
    });

    expect(result.balance).toBe(75000);
    expect(transactionRepository.balanceQueryCount).toBe(0);
  });

  test("menolak filter riwayat dengan tanggal awal setelah tanggal akhir", async () => {
    const context = createAppContext({
      logger: createNoopLogger(),
      serviceName: "test",
      userRepository: new InMemoryUserRepository(),
      transactionRepository: new InMemoryTransactionRepository(),
      deliveryJobRepository: new InMemoryDeliveryJobRepository()
    });

    const service = context.services.coreFinanceService;

    await expect(service.getTransactions({
      userId: "628111",
      fromDateKey: "2026-04-05",
      toDateKey: "2026-04-01"
    })).rejects.toMatchObject({
      code: "INVALID_DATE_RANGE"
    });
  });

  test("bisa mengubah transaksi dan menyinkronkan saldo", async () => {
    const userRepository = new InMemoryUserRepository();
    const transactionRepository = new InMemoryTransactionRepository();
    const context = createAppContext({
      logger: createNoopLogger(),
      serviceName: "test",
      userRepository,
      transactionRepository,
      deliveryJobRepository: new InMemoryDeliveryJobRepository()
    });

    const service = context.services.coreFinanceService;
    const created = await service.createTransaction({
      userId: "628111",
      type: "expense",
      amount: 20000,
      category: "makan",
      transactionDate: "2026-04-05",
      source: "api"
    });

    const updated = await service.updateTransaction({
      userId: "628111",
      transactionId: created.transaction._id,
      type: "income",
      amount: 50000,
      category: "refund",
      transactionDate: "2026-04-04"
    });

    const summary = await service.getSummary({ userId: "628111" });

    expect(updated.transaction.type).toBe("income");
    expect(updated.transaction.category).toBe("refund");
    expect(updated.transaction.dateKey).toBe("2026-04-04");
    expect(updated.balance).toBe(50000);
    expect(summary.balance).toBe(50000);
    expect((await userRepository.findByUserId("628111")).balance).toBe(50000);
  });

  test("bisa mengambil detail transaksi milik user", async () => {
    const context = createAppContext({
      logger: createNoopLogger(),
      serviceName: "test",
      userRepository: new InMemoryUserRepository(),
      transactionRepository: new InMemoryTransactionRepository(),
      deliveryJobRepository: new InMemoryDeliveryJobRepository()
    });

    const service = context.services.coreFinanceService;
    const created = await service.createTransaction({
      userId: "628111",
      type: "expense",
      amount: 20000,
      category: "makan",
      transactionDate: "2026-04-05",
      source: "api"
    });

    const detail = await service.getTransactionDetail({
      userId: "628111",
      transactionId: created.transaction._id
    });

    expect(detail.transaction._id).toBe(created.transaction._id);
    expect(detail.transaction.category).toBe("makan");
    expect(detail.balance).toBe(-20000);
  });

  test("hapus transaksi via konfirmasi dua langkah", async () => {
    const userRepository = new InMemoryUserRepository();
    const transactionRepository = new InMemoryTransactionRepository();
    const context = createAppContext({
      logger: createNoopLogger(),
      serviceName: "test",
      userRepository,
      transactionRepository,
      deliveryJobRepository: new InMemoryDeliveryJobRepository()
    });

    const service = context.services.coreFinanceService;
    const created = await service.createTransaction({
      userId: "628111",
      type: "expense",
      amount: 20000,
      category: "makan",
      source: "api"
    });

    const requestResult = await service.requestTransactionDeletion({
      userId: "628111",
      transactionId: created.transaction._id
    });
    const confirmResult = await service.confirmTransactionDeletion({
      userId: "628111",
      transactionId: created.transaction._id
    });

    expect(requestResult.status).toBe("pending_confirmation");
    expect(requestResult.transaction._id).toBe(created.transaction._id);
    expect(confirmResult.status).toBe("completed");
    expect(confirmResult.transaction._id).toBe(created.transaction._id);
    expect(confirmResult.balance).toBe(0);
    expect((await userRepository.findByUserId("628111")).pendingDeleteTransactionId).toBe(null);
  });

  test("konfirmasi hapus tanpa request sebelumnya menghasilkan noop", async () => {
    const context = createAppContext({
      logger: createNoopLogger(),
      serviceName: "test",
      userRepository: new InMemoryUserRepository(),
      transactionRepository: new InMemoryTransactionRepository(),
      deliveryJobRepository: new InMemoryDeliveryJobRepository()
    });

    const service = context.services.coreFinanceService;
    await service.createTransaction({
      userId: "628111",
      type: "expense",
      amount: 20000,
      category: "makan",
      source: "api"
    });

    const result = await service.confirmTransactionDeletion({
      userId: "628111",
      transactionId: "1"
    });

    expect(result.status).toBe("noop");
    expect(result.message).toContain("hapus 1");
  });

  test("bisa menghapus transaksi dan menyinkronkan saldo", async () => {
    const userRepository = new InMemoryUserRepository();
    const transactionRepository = new InMemoryTransactionRepository();
    const context = createAppContext({
      logger: createNoopLogger(),
      serviceName: "test",
      userRepository,
      transactionRepository,
      deliveryJobRepository: new InMemoryDeliveryJobRepository()
    });

    const service = context.services.coreFinanceService;
    const income = await service.createTransaction({
      userId: "628111",
      type: "income",
      amount: 100000,
      category: "gaji",
      source: "api"
    });
    await service.createTransaction({
      userId: "628111",
      type: "expense",
      amount: 30000,
      category: "makan",
      source: "api"
    });

    const deleted = await service.deleteTransaction({
      userId: "628111",
      transactionId: income.transaction._id
    });

    const summary = await service.getSummary({ userId: "628111" });

    expect(deleted.transaction._id).toBe(income.transaction._id);
    expect(deleted.balance).toBe(-30000);
    expect(summary.balance).toBe(-30000);
    expect((await userRepository.findByUserId("628111")).balance).toBe(-30000);
  });
});
