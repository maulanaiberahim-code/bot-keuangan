const dotenv = require("dotenv");

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSecret(name, fallback, invalidValues = []) {
  const value = String(process.env[name] || "").trim();

  if (value && !isInvalidSecretValue(value, invalidValues)) {
    return value;
  }

  if (nodeEnv === "production") {
    throw new Error(`${name} wajib diisi saat NODE_ENV=production.`);
  }

  return fallback;
}

function isInvalidSecretValue(value, invalidValues) {
  return invalidValues.includes(value);
}

module.exports = {
  botName: process.env.BOT_NAME || "Bot Keuangan",
  logLevel: process.env.LOG_LEVEL || "info",
  logToFile: parseBoolean(process.env.LOG_TO_FILE, true),
  timezone: process.env.TZ || "Asia/Jakarta",
  nodeEnv,
  port: parseNumber(process.env.PORT, 3000),
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bot-keuangan",
  apiKey: getSecret("API_KEY", "local-api-key", [
    "change-this-api-key",
    "local-api-key"
  ]),
  internalAdapterToken: getSecret("INTERNAL_ADAPTER_TOKEN", "local-adapter-token", [
    "change-this-adapter-token",
    "local-adapter-token"
  ]),
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 100),
  whatsappApiBaseUrl: process.env.WHATSAPP_API_BASE_URL || "http://127.0.0.1:3000/api/v1",
  whatsappAdapterBaseUrl: process.env.WHATSAPP_ADAPTER_BASE_URL || "http://127.0.0.1:3100",
  whatsappAdapterPort: parseNumber(process.env.WHATSAPP_ADAPTER_PORT, 3100),
  enableDailyScheduler: parseBoolean(process.env.ENABLE_DAILY_SCHEDULER, false),
  enableMonthlyScheduler: parseBoolean(process.env.ENABLE_MONTHLY_SCHEDULER, true),
  enableRetryWorker: parseBoolean(process.env.ENABLE_RETRY_WORKER, true),
  dailyReportCron: process.env.DAILY_REPORT_CRON || "0 20 * * *",
  monthlyReportCron: process.env.MONTHLY_REPORT_CRON || "0 8 1 * *",
  retryCron: process.env.RETRY_CRON || "*/2 * * * *",
  schedulerMaxAttempts: parseNumber(process.env.SCHEDULER_MAX_ATTEMPTS, 3),
  schedulerRetryDelayMinutes: parseNumber(process.env.SCHEDULER_RETRY_DELAY_MINUTES, 5),
  adminUserIds: parseList(process.env.ADMIN_USER_IDS)
};
