const logger = require("../utils/logger");
const CoreFinanceService = require("./coreFinanceService");
const { createMetricsRegistry } = require("../metrics/createMetricsRegistry");
const MongoUserRepository = require("../db/repositories/MongoUserRepository");
const MongoTransactionRepository = require("../db/repositories/MongoTransactionRepository");
const MongoDeliveryJobRepository = require("../db/repositories/MongoDeliveryJobRepository");
const ExportService = require("../exports/exportService");

function createAppContext(options = {}) {
  const baseLogger = options.logger || logger;
  const metricsBundle = options.metricsBundle || createMetricsRegistry({
    service: options.serviceName || "api"
  });

  const userRepository = options.userRepository || new MongoUserRepository();
  const transactionRepository = options.transactionRepository || new MongoTransactionRepository();
  const deliveryJobRepository = options.deliveryJobRepository || new MongoDeliveryJobRepository();

  const coreFinanceService = options.coreFinanceService || new CoreFinanceService({
    userRepository,
    transactionRepository,
    deliveryJobRepository,
    logger: baseLogger
  });

  const exportService = options.exportService || new ExportService({
    transactionRepository
  });

  return {
    logger: baseLogger,
    metricsBundle,
    metrics: metricsBundle.metrics,
    registry: metricsBundle.registry,
    repositories: {
      deliveryJobRepository,
      transactionRepository,
      userRepository
    },
    services: {
      coreFinanceService,
      exportService
    }
  };
}

module.exports = createAppContext;
