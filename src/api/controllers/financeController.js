const { sendSuccess } = require("../../http/response");

function createFinanceController(context) {
  const financeService = context.services.coreFinanceService;

  return {
    createTransaction: async (req, res, next) => {
      try {
        const result = await financeService.createTransaction({
          ...req.body,
          correlationId: req.context.correlationId,
          source: req.body.source || "api"
        });

        return sendSuccess(res, {
          statusCode: result.duplicate ? 200 : 201,
          data: result
        });
      } catch (error) {
        return next(error);
      }
    },

    getTransactions: async (req, res, next) => {
      try {
        const result = await financeService.getTransactions(req.query);
        return sendSuccess(res, {
          data: result.items,
          meta: result.meta
        });
      } catch (error) {
        return next(error);
      }
    },

    getSummary: async (req, res, next) => {
      try {
        const result = await financeService.getSummary(req.query);
        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    },

    getMonthlyReport: async (req, res, next) => {
      try {
        const result = await financeService.getMonthlyReport({
          userId: req.query.userId,
          monthKey: req.query.month,
          chatId: req.query.chatId || null
        });

        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    },

    getMonthlyChart: async (req, res, next) => {
      try {
        const result = await financeService.getChartData({
          userId: req.query.userId,
          monthKey: req.query.month,
          chatId: req.query.chatId || null
        });

        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    },

    getCategoryBreakdown: async (req, res, next) => {
      try {
        const result = await financeService.getCategoryBreakdown({
          userId: req.query.userId,
          monthKey: req.query.month,
          type: req.query.type,
          chatId: req.query.chatId || null
        });

        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    },

    requestReset: async (req, res, next) => {
      try {
        const result = await financeService.requestReset(req.body);
        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    },

    confirmReset: async (req, res, next) => {
      try {
        const result = await financeService.confirmReset(req.body);
        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    },

    cancelReset: async (req, res, next) => {
      try {
        const result = await financeService.cancelReset(req.body);
        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = createFinanceController;
