const { z } = require("zod");
const { isValidMonthKey } = require("../../utils/dateHelper");

const positiveIntegerString = z.string().trim().min(1);
const monthKeySchema = z.string().trim().refine(isValidMonthKey, {
  message: "Format month harus YYYY-MM dengan bulan 01-12."
}).optional();

const createTransactionBodySchema = z.object({
  userId: z.string().trim().min(1),
  chatId: z.string().trim().optional().nullable(),
  type: z.enum(["income", "expense"]),
  amount: z.union([z.number().int().positive(), positiveIntegerString]),
  category: z.string().trim().min(1),
  source: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional().nullable()
});

const listTransactionsQuerySchema = z.object({
  userId: z.string().trim().min(1),
  category: z.string().trim().optional(),
  type: z.enum(["income", "expense"]).optional(),
  period: z.enum(["today", "month"]).optional(),
  monthKey: monthKeySchema,
  fromDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const summaryQuerySchema = z.object({
  userId: z.string().trim().min(1),
  chatId: z.string().trim().optional().nullable()
});

const monthlyReportQuerySchema = z.object({
  userId: z.string().trim().min(1),
  month: monthKeySchema,
  chatId: z.string().trim().optional().nullable()
});

const categoryBreakdownQuerySchema = z.object({
  userId: z.string().trim().min(1),
  month: monthKeySchema,
  type: z.enum(["income", "expense"]).optional(),
  chatId: z.string().trim().optional().nullable()
});

const chartQuerySchema = z.object({
  userId: z.string().trim().min(1),
  month: monthKeySchema,
  chatId: z.string().trim().optional().nullable()
});

const resetBodySchema = z.object({
  userId: z.string().trim().min(1),
  chatId: z.string().trim().optional().nullable()
});

const adminQuerySchema = z.object({
  userId: z.string().trim().min(1),
  month: monthKeySchema,
  type: z.enum(["income", "expense"]).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional()
});

const exportQuerySchema = z.object({
  userId: z.string().trim().min(1),
  month: monthKeySchema,
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().trim().optional()
});

module.exports = {
  adminQuerySchema,
  categoryBreakdownQuerySchema,
  chartQuerySchema,
  createTransactionBodySchema,
  exportQuerySchema,
  listTransactionsQuerySchema,
  monthlyReportQuerySchema,
  resetBodySchema,
  summaryQuerySchema
};
