const { z } = require("zod");
const { isValidDayKey, isValidMonthKey } = require("../../utils/dateHelper");

const positiveIntegerString = z.string().trim().min(1);
const userIdSchema = z.string().trim().regex(/^\d+$/, {
  message: "userId harus berupa digit saja."
});
const monthKeySchema = z.string().trim().refine(isValidMonthKey, {
  message: "Format month harus YYYY-MM dengan bulan 01-12."
}).optional();
const dayKeySchema = z.string().trim().refine(isValidDayKey, {
  message: "Format tanggal harus YYYY-MM-DD."
}).optional();

const createTransactionBodySchema = z.object({
  userId: userIdSchema,
  chatId: z.string().trim().optional().nullable(),
  type: z.enum(["income", "expense"]),
  amount: z.union([z.number().int().positive(), positiveIntegerString]),
  category: z.string().trim().min(1),
  transactionDate: dayKeySchema,
  source: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional().nullable()
});

const updateTransactionBodySchema = z.object({
  userId: userIdSchema,
  chatId: z.string().trim().optional().nullable(),
  type: z.enum(["income", "expense"]).optional(),
  amount: z.union([z.number().int().positive(), positiveIntegerString]).optional(),
  category: z.string().trim().min(1).optional(),
  transactionDate: dayKeySchema
}).refine((value) => (
  value.type !== undefined ||
  value.amount !== undefined ||
  value.category !== undefined ||
  value.transactionDate !== undefined
), {
  message: "Minimal ada satu field transaksi yang diubah."
});

const transactionParamsSchema = z.object({
  transactionId: z.string().trim().min(1)
});

const deleteTransactionQuerySchema = z.object({
  userId: userIdSchema,
  chatId: z.string().trim().optional().nullable()
});

const transactionActionBodySchema = z.object({
  userId: userIdSchema,
  chatId: z.string().trim().optional().nullable()
});

const listTransactionsQuerySchema = z.object({
  userId: userIdSchema,
  category: z.string().trim().optional(),
  type: z.enum(["income", "expense"]).optional(),
  period: z.enum(["today", "month"]).optional(),
  monthKey: monthKeySchema,
  fromDateKey: dayKeySchema,
  toDateKey: dayKeySchema,
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const summaryQuerySchema = z.object({
  userId: userIdSchema,
  chatId: z.string().trim().optional().nullable()
});

const monthlyReportQuerySchema = z.object({
  userId: userIdSchema,
  month: monthKeySchema,
  chatId: z.string().trim().optional().nullable()
});

const categoryBreakdownQuerySchema = z.object({
  userId: userIdSchema,
  month: monthKeySchema,
  type: z.enum(["income", "expense"]).optional(),
  chatId: z.string().trim().optional().nullable()
});

const chartQuerySchema = z.object({
  userId: userIdSchema,
  month: monthKeySchema,
  chatId: z.string().trim().optional().nullable()
});

const resetBodySchema = z.object({
  userId: userIdSchema,
  chatId: z.string().trim().optional().nullable()
});

const adminQuerySchema = z.object({
  userId: userIdSchema,
  month: monthKeySchema,
  type: z.enum(["income", "expense"]).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional()
});

const exportQuerySchema = z.object({
  userId: userIdSchema,
  month: monthKeySchema,
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().trim().optional()
});

module.exports = {
  adminQuerySchema,
  categoryBreakdownQuerySchema,
  chartQuerySchema,
  createTransactionBodySchema,
  deleteTransactionQuerySchema,
  exportQuerySchema,
  listTransactionsQuerySchema,
  monthlyReportQuerySchema,
  resetBodySchema,
  summaryQuerySchema,
  transactionActionBodySchema,
  transactionParamsSchema,
  updateTransactionBodySchema
};
