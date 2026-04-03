const { sendSuccess } = require("../../http/response");

function createAdminController(context) {
  const financeService = context.services.coreFinanceService;

  return {
    getGlobalStats: async (req, res, next) => {
      try {
        await financeService.ensureAdminAccess(req.query.userId);
        const result = await financeService.getGlobalStats({
          monthKey: req.query.month
        });

        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    },

    getTopCategories: async (req, res, next) => {
      try {
        await financeService.ensureAdminAccess(req.query.userId);
        const result = await financeService.getTopCategories({
          monthKey: req.query.month,
          type: req.query.type,
          limit: req.query.limit || 5
        });

        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    },

    getMostActiveUsers: async (req, res, next) => {
      try {
        await financeService.ensureAdminAccess(req.query.userId);
        const result = await financeService.getMostActiveUsers({
          monthKey: req.query.month,
          limit: req.query.limit || 5
        });

        return sendSuccess(res, { data: result });
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = createAdminController;
