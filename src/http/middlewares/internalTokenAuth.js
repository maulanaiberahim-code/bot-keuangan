const AppError = require("../../errors/AppError");

function internalTokenAuth({ token }) {
  return function authorize(req, res, next) {
    const incomingToken = req.headers["x-internal-token"];

    if (!incomingToken || incomingToken !== token) {
      return next(new AppError("Internal token tidak valid.", 401, "UNAUTHORIZED_INTERNAL"));
    }

    next();
  };
}

module.exports = internalTokenAuth;
