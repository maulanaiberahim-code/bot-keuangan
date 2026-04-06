const DeliveryWorker = require("../src/scheduler/deliveryWorker");
const { InMemoryDeliveryJobRepository } = require("../src/testing/inMemoryRepositories");

function createNoopLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {}
  };
}

function createNoopMetrics() {
  return {
    schedulerJobsTotal: {
      inc() {}
    }
  };
}

describe("DeliveryWorker", () => {
  test("melewati job yang sudah di-claim worker lain", async () => {
    const repository = new InMemoryDeliveryJobRepository();
    const gateway = {
      sendText: jest.fn()
    };

    const job = await repository.createOrGetJob({
      userId: "628111",
      chatId: "628111@s.whatsapp.net",
      channel: "whatsapp",
      reportType: "daily",
      periodKey: "2026-04-06",
      payload: {
        date: "2026-04-06",
        totals: {
          income: 0,
          expense: 0,
          net: 0,
          transactionCount: 0
        },
        topExpenseCategory: null
      },
      maxAttempts: 3,
      status: "pending",
      attempts: 0,
      nextRetryAt: new Date()
    });

    const claimed = await repository.markProcessing(job._id);
    const claimedAgain = await repository.markProcessing(job._id);
    const worker = new DeliveryWorker({
      deliveryJobRepository: repository,
      deliveryGateway: gateway,
      logger: createNoopLogger(),
      metrics: createNoopMetrics()
    });

    expect(claimed).not.toBeNull();
    expect(claimedAgain).toBeNull();

    await worker.processDueJobs();

    expect(gateway.sendText).not.toHaveBeenCalled();
  });
});
