const rateLimit = require("express-rate-limit");

function createRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false
  });
}

module.exports = createRateLimiter;
