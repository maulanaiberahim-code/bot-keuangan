const fs = require("fs");
const path = require("path");
const { DATA_FILE_PATH, STORAGE_DIR } = require("../config/paths");

const defaultData = {
  users: {}
};

class JsonStore {
  constructor(filePath = DATA_FILE_PATH) {
    this.filePath = filePath;
    this.ensureFile();
  }

  ensureFile() {
    const dirPath = path.dirname(this.filePath);

    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(defaultData, null, 2), "utf8");
    }
  }

  read() {
    this.ensureFile();
    const rawContent = fs.readFileSync(this.filePath, "utf8");

    if (!rawContent.trim()) {
      return structuredClone(defaultData);
    }

    const parsed = JSON.parse(rawContent);
    return this.migrate(parsed);
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  migrate(data) {
    if (data.users) {
      return data;
    }

    if (!data.chats) {
      return structuredClone(defaultData);
    }

    const migratedUsers = Object.entries(data.chats).reduce((accumulator, [legacyId, state]) => {
      const normalizedUserId = String(legacyId).replace(/[^0-9]/g, "") || legacyId;
      accumulator[normalizedUserId] = {
        balance: state.balance || 0,
        pendingReset: Boolean(state.pendingReset),
        sequence: state.sequence || 0,
        transactions: (state.transactions || []).map((transaction) => ({
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          category: transaction.category || transaction.description || "lainnya",
          createdAt: transaction.createdAt
        }))
      };
      return accumulator;
    }, {});

    return {
      users: migratedUsers
    };
  }
}

module.exports = JsonStore;
