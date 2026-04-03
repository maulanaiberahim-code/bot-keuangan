const { sendSuccess } = require("../../http/response");

function createSystemController(context) {
  return {
    health: async (_req, res) => sendSuccess(res, {
      data: {
        service: "bot-keuangan-api",
        status: "ok"
      }
    }),

    metrics: async (_req, res, next) => {
      try {
        res.setHeader("Content-Type", context.registry.contentType);
        const payload = await context.registry.metrics();
        return res.status(200).send(payload);
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = createSystemController;
