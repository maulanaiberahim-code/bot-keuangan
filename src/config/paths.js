const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");

module.exports = {
  ROOT_DIR,
  LOG_DIR: path.join(ROOT_DIR, "logs"),
  LOG_FILE_PATH: path.join(ROOT_DIR, "logs", "app.log"),
  STORAGE_DIR: path.join(ROOT_DIR, "storage"),
  DATA_FILE_PATH: path.join(ROOT_DIR, "storage", "transactions.json"),
  AUTH_DIR: path.join(ROOT_DIR, "auth"),
  EXPORT_DIR: path.join(ROOT_DIR, "exports")
};
