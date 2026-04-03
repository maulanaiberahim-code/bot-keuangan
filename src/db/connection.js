const mongoose = require("mongoose");
const env = require("../config/env");
const logger = require("../utils/logger");

async function connectDatabase(uri = env.mongodbUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  logger.info("database_connected", {
    uri: sanitizeMongoUri(uri)
  });
}

async function disconnectDatabase() {
  await mongoose.disconnect();
  logger.info("database_disconnected");
}

function sanitizeMongoUri(uri) {
  if (!uri) {
    return uri;
  }

  try {
    const parsedUri = new URL(uri);

    if (parsedUri.username || parsedUri.password) {
      parsedUri.username = "***";
      parsedUri.password = "***";
    }

    return parsedUri.toString();
  } catch (_error) {
    return String(uri).replace(/\/\/([^:/?#]+)(?::[^@]*)?@/, "//***:***@");
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase
};
