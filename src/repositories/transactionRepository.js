const JsonStore = require("../data/jsonStore");

function createDefaultChatState() {
  return {
    balance: 0,
    transactions: [],
    pendingReset: false,
    sequence: 0
  };
}

class TransactionRepository {
  constructor(store = new JsonStore()) {
    this.store = store;
  }

  getUserState(userId) {
    const data = this.store.read();
    const currentState = data.users[userId] || createDefaultChatState();

    return {
      data,
      state: currentState
    };
  }

  saveUserState(userId, state, rootData) {
    const data = rootData || this.store.read();
    data.users[userId] = state;
    this.store.write(data);
    return state;
  }

  appendTransaction(userId, transactionInput) {
    const { data, state } = this.getUserState(userId);
    const nextState = { ...state };

    nextState.sequence += 1;
    nextState.transactions.push({
      id: nextState.sequence,
      ...transactionInput
    });

    nextState.balance += transactionInput.type === "income"
      ? transactionInput.amount
      : -transactionInput.amount;
    nextState.pendingReset = false;

    this.saveUserState(userId, nextState, data);
    return nextState;
  }

  getBalance(userId) {
    const { state } = this.getUserState(userId);
    return state.balance;
  }

  getTransactions(userId) {
    const { state } = this.getUserState(userId);
    return [...state.transactions].sort((a, b) => b.id - a.id);
  }

  markResetPending(userId) {
    const { data, state } = this.getUserState(userId);
    const nextState = { ...state, pendingReset: true };
    this.saveUserState(userId, nextState, data);
    return nextState.pendingReset;
  }

  clearResetPending(userId) {
    const { data, state } = this.getUserState(userId);
    const nextState = { ...state, pendingReset: false };
    this.saveUserState(userId, nextState, data);
    return nextState.pendingReset;
  }

  isResetPending(userId) {
    const { state } = this.getUserState(userId);
    return state.pendingReset;
  }

  resetUser(userId) {
    const { data } = this.getUserState(userId);
    const resetState = createDefaultChatState();
    this.saveUserState(userId, resetState, data);
    return resetState;
  }
}

module.exports = TransactionRepository;
