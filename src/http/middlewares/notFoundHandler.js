const AppError = require("../../errors/AppError");

function notFoundHandler(req, _res, next) {
  next(new AppError(`Route tidak ditemukan: ${req.originalUrl}`, 404, "ROUTE_NOT_FOUND"));
}

module.exports = notFoundHandler;
