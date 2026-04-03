const { z } = require("zod");
const request = require("supertest");
const createTestApp = require("../../src/testing/createTestApp");

const successEnvelopeSchema = z.object({
  success: z.literal(true),
  correlationId: z.string().min(1),
  data: z.unknown(),
  meta: z.unknown().optional()
});

const summarySchema = successEnvelopeSchema.extend({
  data: z.object({
    userId: z.string(),
    balance: z.number(),
    role: z.enum(["user", "admin"]),
    stats: z.object({
      totalTransactions: z.number(),
      currentMonthIncome: z.number(),
      currentMonthExpense: z.number()
    })
  })
});

const monthlyReportSchema = successEnvelopeSchema.extend({
  data: z.object({
    userId: z.string(),
    month: z.string(),
    totals: z.object({
      income: z.number(),
      expense: z.number(),
      net: z.number(),
      transactionCount: z.number()
    }),
    incomeBreakdown: z.array(z.object({
      category: z.string(),
      amount: z.number(),
      count: z.number()
    })),
    expenseBreakdown: z.array(z.object({
      category: z.string(),
      amount: z.number(),
      count: z.number()
    })),
    insights: z.object({
      topIncomeCategory: z.object({
        category: z.string(),
        amount: z.number(),
        count: z.number()
      }).nullable(),
      topExpenseCategory: z.object({
        category: z.string(),
        amount: z.number(),
        count: z.number()
      }).nullable()
    })
  })
});

describe("API contract", () => {
  let app;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  test("GET /summary mengikuti response contract", async () => {
    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "income",
        amount: 75000,
        category: "gaji",
        source: "api"
      });

    const response = await request(app)
      .get("/api/v1/summary")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628111" });

    expect(() => summarySchema.parse(response.body)).not.toThrow();
  });

  test("GET /reports/monthly mengikuti response contract", async () => {
    await request(app)
      .post("/api/v1/transactions")
      .set("x-api-key", "local-api-key")
      .send({
        userId: "628111",
        type: "income",
        amount: 120000,
        category: "gaji",
        source: "api"
      });

    const response = await request(app)
      .get("/api/v1/reports/monthly")
      .set("x-api-key", "local-api-key")
      .query({ userId: "628111" });

    expect(() => monthlyReportSchema.parse(response.body)).not.toThrow();
  });
});
