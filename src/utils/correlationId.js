const crypto = require("crypto");

function generateCorrelationId() {
  return crypto.randomUUID();
}

module.exports = {
  generateCorrelationId
};
