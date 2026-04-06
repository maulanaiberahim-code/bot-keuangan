const createApp = require("../api/createApp");
const createAppContext = require("../app/createAppContext");
const {
  InMemoryDeliveryJobRepository,
  InMemoryTransactionRepository,
  InMemoryUserRepository
} = require("./inMemoryRepositories");

const DEFAULT_TEST_API_KEY = "local-api-key";

function createTestApp(options = {}) {
  const logger = createNoopLogger();
  const adminUserIds = options.adminUserIds || [];
  const userRepository = options.userRepository || new InMemoryUserRepository({
    adminUserIds
  });
  const transactionRepository = options.transactionRepository || new InMemoryTransactionRepository();
  const deliveryJobRepository = options.deliveryJobRepository || new InMemoryDeliveryJobRepository();

  const context = createAppContext({
    logger,
    serviceName: "test",
    adminUserIds,
    userRepository,
    transactionRepository,
    deliveryJobRepository
  });

  const { app } = createApp({
    context,
    apiKey: options.apiKey ?? DEFAULT_TEST_API_KEY
  });

  return {
    app,
    context,
    apiKey: options.apiKey ?? DEFAULT_TEST_API_KEY,
    repositories: {
      deliveryJobRepository,
      transactionRepository,
      userRepository
    }
  };
}

function createNoopLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {}
  };
}

module.exports = createTestApp;
module.exports.DEFAULT_TEST_API_KEY = DEFAULT_TEST_API_KEY;
