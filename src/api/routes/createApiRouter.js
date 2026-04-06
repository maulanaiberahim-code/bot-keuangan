const express = require("express");
const validateRequest = require("../../http/middlewares/validateRequest");
const createFinanceController = require("../controllers/financeController");
const createAdminController = require("../controllers/adminController");
const createExportController = require("../controllers/exportController");
const {
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
} = require("../schemas/financeSchemas");

function createApiRouter(context) {
  const router = express.Router();
  const financeController = createFinanceController(context);
  const adminController = createAdminController(context);
  const exportController = createExportController(context);

  router.post(
    "/transactions",
    validateRequest({ body: createTransactionBodySchema }),
    financeController.createTransaction
  );

  router.get(
    "/transactions",
    validateRequest({ query: listTransactionsQuerySchema }),
    financeController.getTransactions
  );

  router.get(
    "/transactions/:transactionId",
    validateRequest({
      params: transactionParamsSchema,
      query: deleteTransactionQuerySchema
    }),
    financeController.getTransactionDetail
  );

  router.post(
    "/transactions/:transactionId/delete-request",
    validateRequest({
      params: transactionParamsSchema,
      body: transactionActionBodySchema
    }),
    financeController.requestTransactionDeletion
  );

  router.post(
    "/transactions/:transactionId/delete-confirm",
    validateRequest({
      params: transactionParamsSchema,
      body: transactionActionBodySchema
    }),
    financeController.confirmTransactionDeletion
  );

  router.patch(
    "/transactions/:transactionId",
    validateRequest({
      params: transactionParamsSchema,
      body: updateTransactionBodySchema
    }),
    financeController.updateTransaction
  );

  router.delete(
    "/transactions/:transactionId",
    validateRequest({
      params: transactionParamsSchema,
      query: deleteTransactionQuerySchema
    }),
    financeController.deleteTransaction
  );

  router.get(
    "/summary",
    validateRequest({ query: summaryQuerySchema }),
    financeController.getSummary
  );

  router.get(
    "/reports/monthly",
    validateRequest({ query: monthlyReportQuerySchema }),
    financeController.getMonthlyReport
  );

  router.get(
    "/reports/monthly/chart",
    validateRequest({ query: chartQuerySchema }),
    financeController.getMonthlyChart
  );

  router.get(
    "/reports/monthly/categories",
    validateRequest({ query: categoryBreakdownQuerySchema }),
    financeController.getCategoryBreakdown
  );

  router.post(
    "/resets/request",
    validateRequest({ body: resetBodySchema }),
    financeController.requestReset
  );

  router.post(
    "/resets/confirm",
    validateRequest({ body: resetBodySchema }),
    financeController.confirmReset
  );

  router.post(
    "/resets/cancel",
    validateRequest({ body: resetBodySchema }),
    financeController.cancelReset
  );

  router.get(
    "/admin/stats",
    validateRequest({ query: adminQuerySchema }),
    adminController.getGlobalStats
  );

  router.get(
    "/admin/categories/top",
    validateRequest({ query: adminQuerySchema }),
    adminController.getTopCategories
  );

  router.get(
    "/admin/users/active",
    validateRequest({ query: adminQuerySchema }),
    adminController.getMostActiveUsers
  );

  router.get(
    "/exports/transactions.csv",
    validateRequest({ query: exportQuerySchema }),
    exportController.exportCsv
  );

  router.get(
    "/exports/transactions.xlsx",
    validateRequest({ query: exportQuerySchema }),
    exportController.exportExcel
  );

  return router;
}

module.exports = createApiRouter;
