const fs = require("fs");
const { createLogger, format, transports } = require("winston");
const env = require("../config/env");
const { LOG_DIR, LOG_FILE_PATH } = require("../config/paths");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const jsonFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

const loggerTransports = [
  new transports.Console({
    format: jsonFormat
  })
];

if (env.logToFile) {
  loggerTransports.push(
    new transports.File({
      filename: LOG_FILE_PATH,
      format: jsonFormat
    })
  );
}

const logger = createLogger({
  level: env.logLevel,
  format: jsonFormat,
  transports: loggerTransports
});

logger.stream = {
  write: (message) => logger.info(message.trim())
};

module.exports = logger;
