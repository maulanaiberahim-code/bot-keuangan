const JsonStore = require("../src/data/jsonStore");
const { connectDatabase, disconnectDatabase } = require("../src/db/connection");
const UserModel = require("../src/db/models/UserModel");
const TransactionModel = require("../src/db/models/TransactionModel");
const { getLocalDateParts } = require("../src/utils/dateHelper");

async function migrate() {
  const store = new JsonStore();
  const snapshot = store.read();
  const users = Object.entries(snapshot.users || {});

  await connectDatabase();

  for (const [userId, state] of users) {
    await UserModel.updateOne(
      { userId },
      {
        $set: {
          balance: state.balance || 0,
          pendingReset: Boolean(state.pendingReset),
          lastInteractionAt: state.transactions?.length
            ? new Date(state.transactions[state.transactions.length - 1].createdAt)
            : null,
          isActive: true
        },
        $setOnInsert: {
          role: "user"
        }
      },
      { upsert: true }
    );

    for (const transaction of state.transactions || []) {
      const createdAt = transaction.createdAt || new Date().toISOString();
      const { dateKey, monthKey } = getLocalDateParts(createdAt);

      await TransactionModel.updateOne(
        {
          userId,
          createdAt: new Date(createdAt),
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category
        },
        {
          $setOnInsert: {
            userId,
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            source: "json-migration",
            chatId: null,
            correlationId: null,
            idempotencyKey: null,
            dateKey,
            monthKey,
            createdAt: new Date(createdAt),
            updatedAt: new Date(createdAt)
          }
        },
        { upsert: true }
      );
    }
  }

  console.log(`Migrated ${users.length} user(s) from JSON to MongoDB.`);
}

migrate()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
