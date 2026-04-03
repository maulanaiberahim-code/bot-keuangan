const AppError = require("../../errors/AppError");

function apiKeyAuth({ apiKey }) {
  return function authorize(req, res, next) {
    const incomingApiKey = req.headers["x-api-key"];

    if (!incomingApiKey || incomingApiKey !== apiKey) {
      return next(new AppError("API key tidak valid.", 401, "UNAUTHORIZED"));
    }

    next();
  };
}

module.exports = apiKeyAuth;
