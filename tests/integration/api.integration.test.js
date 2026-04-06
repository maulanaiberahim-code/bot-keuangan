const request = require("supertest");
const createTestApp = require("../../src/testing/createTestApp");

describe("API integration", () => {
  let app;

  beforeEach(() => {
    ({ app } = createTestApp({
      adminUserIds: ["628999"]
    }));
  });

  test("POST /transactions mencatat pemasukan dan mengembalikan saldo terbaru", async () => {
    const response = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "income",
        amount: 50000,
        category: "gaji",
        source: "api",
        idempotencyKey: "income-1"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.balance).toBe(50000);
    expect(response.body.data.transaction.category).toBe("gaji");
  });

  test("POST /transactions bisa mencatat transaksi untuk hari sebelumnya", async () => {
    const response = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 20000,
        category: "makan",
        transactionDate: "2026-04-05",
        source: "api",
        idempotencyKey: "expense-backdate-1"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.transaction.dateKey).toBe("2026-04-05");
    expect(response.body.data.transaction.transactionAt).toContain("2026-04-05");
  });

  test("POST /transactions menolak tanggal transaksi di masa depan", async () => {
    const response = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "income",
        amount: 50000,
        category: "gaji",
        transactionDate: "2099-01-01",
        source: "api"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_TRANSACTION_DATE");
  });

  test("duplicate request dengan idempotency key tidak menggandakan saldo", async () => {
    const payload = {
      userId: "628111",
      type: "income",
      amount: 50000,
      category: "gaji",
      source: "api",
      idempotencyKey: "dup-1"
    };

    const [first, second] = await Promise.all([
      request(app).post("/api/v1/transactions").set("x-api-key", "local-api-key").send(payload),
      request(app).post("/api/v1/transactions").set("x-api-key", "local-api-key").send(payload)
    ]);

    const summary = await request(app)
      .get("/api/v1/summary")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628111" });

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(summary.body.data.balance).toBe(50000);
  });

  test("GET /transactions bisa filter berdasarkan kategori", async () => {
    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 20000,
        category: "makan",
        source: "api"
      });

    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 15000,
        category: "transport",
        source: "api"
      });

    const response = await request(app)
      .get("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .query({
        userId: "628111",
        category: "makan"
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].category).toBe("makan");
  });

  test("PATCH /transactions/:transactionId bisa mengubah transaksi", async () => {
    const created = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 20000,
        category: "makan",
        source: "api"
      });

    const response = await request(app)
      .patch(`/api/v1/transactions/${created.body.data.transaction._id}`)
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "income",
        amount: 50000,
        category: "refund",
        transactionDate: "2026-04-05"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.transaction.type).toBe("income");
    expect(response.body.data.transaction.category).toBe("refund");
    expect(response.body.data.transaction.dateKey).toBe("2026-04-05");
    expect(response.body.data.balance).toBe(50000);
  });

  test("GET /transactions/:transactionId bisa mengambil detail transaksi", async () => {
    const created = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 20000,
        category: "makan",
        transactionDate: "2026-04-05",
        source: "api"
      });

    const response = await request(app)
      .get(`/api/v1/transactions/${created.body.data.transaction._id}`)
      .set("x-api-key", "local-api-key")
      .query({
        userId: "628111"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.transaction._id).toBe(created.body.data.transaction._id);
    expect(response.body.data.transaction.category).toBe("makan");
    expect(response.body.data.balance).toBe(-20000);
  });

  test("POST /transactions/:transactionId/delete-request lalu delete-confirm menghapus transaksi", async () => {
    const created = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 20000,
        category: "makan",
        source: "api"
      });

    const requestDeletion = await request(app)
      .post(`/api/v1/transactions/${created.body.data.transaction._id}/delete-request`)
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111"
      });

    const confirmDeletion = await request(app)
      .post(`/api/v1/transactions/${created.body.data.transaction._id}/delete-confirm`)
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111"
      });

    expect(requestDeletion.status).toBe(200);
    expect(requestDeletion.body.data.status).toBe("pending_confirmation");
    expect(confirmDeletion.status).toBe(200);
    expect(confirmDeletion.body.data.status).toBe("completed");
    expect(confirmDeletion.body.data.balance).toBe(0);
  });

  test("POST /transactions/:transactionId/delete-confirm tanpa request menghasilkan noop", async () => {
    const created = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 20000,
        category: "makan",
        source: "api"
      });

    const response = await request(app)
      .post(`/api/v1/transactions/${created.body.data.transaction._id}/delete-confirm`)
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("noop");
  });

  test("DELETE /transactions/:transactionId bisa menghapus transaksi", async () => {
    const created = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "income",
        amount: 50000,
        category: "gaji",
        source: "api"
      });

    const response = await request(app)
      .delete(`/api/v1/transactions/${created.body.data.transaction._id}`)
      .set("x-api-key", "local-api-key")
      .query({
        userId: "628111"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.transaction._id).toBe(created.body.data.transaction._id);
    expect(response.body.data.balance).toBe(0);
  });

  test("PATCH /transactions/:transactionId menolak update tanpa perubahan", async () => {
    const created = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 20000,
        category: "makan",
        source: "api"
      });

    const response = await request(app)
      .patch(`/api/v1/transactions/${created.body.data.transaction._id}`)
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("GET /transactions bisa filter berdasarkan rentang tanggal", async () => {
    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 10000,
        category: "kopi",
        transactionDate: "2026-04-01",
        source: "api"
      });

    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 20000,
        category: "makan",
        transactionDate: "2026-04-03",
        source: "api"
      });

    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 30000,
        category: "transport",
        transactionDate: "2026-04-06",
        source: "api"
      });

    const response = await request(app)
      .get("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .query({
        userId: "628111",
        fromDateKey: "2026-04-02",
        toDateKey: "2026-04-05"
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].category).toBe("makan");
  });

  test("GET /transactions menolak rentang tanggal yang terbalik", async () => {
    const response = await request(app)
      .get("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .query({
        userId: "628111",
        fromDateKey: "2026-04-05",
        toDateKey: "2026-04-01"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_DATE_RANGE");
  });

  test("GET /reports/monthly mengembalikan breakdown kategori dan insight", async () => {
    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "income",
        amount: 100000,
        category: "gaji",
        source: "api"
      });

    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "expense",
        amount: 25000,
        category: "makan",
        source: "api"
      });

    const response = await request(app)
      .get("/api/v1/reports/monthly")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628111" });

    expect(response.status).toBe(200);
    expect(response.body.data.totals.income).toBe(100000);
    expect(response.body.data.totals.expense).toBe(25000);
    expect(response.body.data.incomeBreakdown[0].category).toBe("gaji");
    expect(response.body.data.insights.topExpenseCategory.category).toBe("makan");
  });

  test("endpoint admin menolak user non-admin", async () => {
    const response = await request(app)
      .get("/api/v1/admin/stats")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628111" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ADMIN_ONLY");
  });

  test("endpoint admin menerima admin user", async () => {
    const response = await request(app)
      .get("/api/v1/admin/stats")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628999" });

    expect(response.status).toBe(200);
    expect(response.body.data.totals.admins).toBe(0);
    expect(response.body.data.totals.users).toBe(0);
  });

  test("GET /summary untuk user baru tidak menambah jumlah user tersimpan", async () => {
    const initialStats = await request(app)
      .get("/api/v1/admin/stats")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628999" });

    const summary = await request(app)
      .get("/api/v1/summary")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628111" });

    const finalStats = await request(app)
      .get("/api/v1/admin/stats")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628999" });

    expect(summary.status).toBe(200);
    expect(summary.body.data.balance).toBe(0);
    expect(finalStats.body.data.totals.users).toBe(initialStats.body.data.totals.users);
  });

  test("endpoint export menolak userId yang tidak aman", async () => {
    const response = await request(app)
      .get("/api/v1/exports/transactions.csv")
      .set("x-api-key", "local-api-key")
      .query({ userId: "/../../../tmp/pwn" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("payload invalid mengembalikan 400", async () => {
    const response = await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "income",
        amount: 0,
        category: ""
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("query month invalid mengembalikan 400", async () => {
    const response = await request(app)
      .get("/api/v1/reports/monthly")
      .set("x-api-key", "local-api-key")
      .query({
        userId: "628111",
        month: "2026-13"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
