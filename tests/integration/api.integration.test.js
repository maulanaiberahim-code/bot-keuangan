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
    expect(response.body.data.totals.admins).toBeGreaterThanOrEqual(1);
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
