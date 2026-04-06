const path = require("path");
const { normalizeUserId } = require("../../utils/user");

function createExportController(context) {
  const financeService = context.services.coreFinanceService;
  const exportService = context.services.exportService;

  return {
    exportCsv: async (req, res, next) => {
      try {
        const transactions = await financeService.getExportTransactions({
          userId: req.query.userId,
          monthKey: req.query.month,
          type: req.query.type,
          category: req.query.category
        });

        const fileName = buildFileName("transactions", req.query.userId, req.query.month, "csv");
        const result = await exportService.buildCsvExport(transactions, fileName);

        return res.download(result.filePath, path.basename(result.filePath));
      } catch (error) {
        return next(error);
      }
    },

    exportExcel: async (req, res, next) => {
      try {
        const transactions = await financeService.getExportTransactions({
          userId: req.query.userId,
          monthKey: req.query.month,
          type: req.query.type,
          category: req.query.category
        });

        const fileName = buildFileName("transactions", req.query.userId, req.query.month, "xlsx");
        const result = await exportService.buildExcelExport(transactions, fileName);

        return res.download(result.filePath, path.basename(result.filePath));
      } catch (error) {
        return next(error);
      }
    }
  };
}

function buildFileName(prefix, userId, month, extension) {
  const normalizedUserId = normalizeUserId(userId) || "unknown-user";
  const suffix = /^\d{4}-\d{2}$/.test(String(month || "")) ? month : "all";
  return `${prefix}-${normalizedUserId}-${suffix}.${extension}`;
}

module.exports = createExportController;
