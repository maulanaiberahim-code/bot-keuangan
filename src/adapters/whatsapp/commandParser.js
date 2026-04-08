const { isValidDayKey, isValidMonthKey } = require("../../utils/dateHelper");
const { parseAmount } = require("../../utils/amount");

function parseCommand(text) {
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const lowerText = normalized.toLowerCase();

  if (lowerText === "help") {
    return { name: "help" };
  }

  if (lowerText === "saldo") {
    return { name: "summary" };
  }

  if (lowerText === "riwayat") {
    return { name: "history", filter: {} };
  }

  if (lowerText === "riwayat hari ini") {
    return { name: "history", filter: { period: "today" } };
  }

  if (lowerText === "riwayat bulan ini") {
    return { name: "history", filter: { period: "month" } };
  }

  const historyDetailMatch = normalized.match(/^riwayat detail\s+(\S+)$/i);
  if (historyDetailMatch) {
    return {
      name: "transaction_detail",
      transactionId: historyDetailMatch[1]
    };
  }

  const historyRangeMatch = normalized.match(/^riwayat\s+(\d{4}-\d{2}-\d{2})\s+(?:sampai|s\/d)\s+(\d{4}-\d{2}-\d{2})$/i);
  if (historyRangeMatch && isValidDayKey(historyRangeMatch[1]) && isValidDayKey(historyRangeMatch[2])) {
    return {
      name: "history",
      filter: {
        fromDateKey: historyRangeMatch[1],
        toDateKey: historyRangeMatch[2]
      }
    };
  }

  const historyCategoryMatch = normalized.match(/^riwayat kategori\s+(.+)$/i);
  if (historyCategoryMatch) {
    return {
      name: "history",
      filter: {
        category: historyCategoryMatch[1].trim().toLowerCase()
      }
    };
  }

  if (lowerText === "laporan bulan ini") {
    return { name: "monthly_report", month: null };
  }

  const monthReportMatch = normalized.match(/^laporan\s+(\d{4}-\d{2})$/i);
  if (monthReportMatch && isValidMonthKey(monthReportMatch[1])) {
    return { name: "monthly_report", month: monthReportMatch[1] };
  }

  if (lowerText === "reset") {
    return { name: "reset_request" };
  }

  if (lowerText === "ya reset") {
    return { name: "reset_confirm" };
  }

  if (lowerText === "batal reset") {
    return { name: "reset_cancel" };
  }

  if (lowerText === "admin stats") {
    return { name: "admin_stats", month: null };
  }

  const adminStatsMonthMatch = normalized.match(/^admin stats\s+(\d{4}-\d{2})$/i);
  if (adminStatsMonthMatch && isValidMonthKey(adminStatsMonthMatch[1])) {
    return { name: "admin_stats", month: adminStatsMonthMatch[1] };
  }

  if (lowerText === "admin kategori") {
    return { name: "admin_top_categories", month: null };
  }

  const adminCategoryMonthMatch = normalized.match(/^admin kategori\s+(\d{4}-\d{2})$/i);
  if (adminCategoryMonthMatch && isValidMonthKey(adminCategoryMonthMatch[1])) {
    return { name: "admin_top_categories", month: adminCategoryMonthMatch[1] };
  }

  if (lowerText === "admin user aktif") {
    return { name: "admin_active_users", month: null };
  }

  const adminActiveUsersMonthMatch = normalized.match(/^admin user aktif\s+(\d{4}-\d{2})$/i);
  if (adminActiveUsersMonthMatch && isValidMonthKey(adminActiveUsersMonthMatch[1])) {
    return { name: "admin_active_users", month: adminActiveUsersMonthMatch[1] };
  }

  const incomeMatch = normalized.match(/^masuk\s+(.+)$/i);
  if (incomeMatch) {
    const parsedPayload = parseTransactionPayload(incomeMatch[1]);

    if (!parsedPayload) {
      return {
        name: "unknown"
      };
    }

    return {
      name: "income",
      amount: parsedPayload.amount,
      category: parsedPayload.category,
      transactionDate: parsedPayload.transactionDate
    };
  }

  const expenseMatch = normalized.match(/^keluar\s+(.+)$/i);
  if (expenseMatch) {
    const parsedPayload = parseTransactionPayload(expenseMatch[1]);

    if (!parsedPayload) {
      return {
        name: "unknown"
      };
    }

    return {
      name: "expense",
      amount: parsedPayload.amount,
      category: parsedPayload.category,
      transactionDate: parsedPayload.transactionDate
    };
  }

  const updateMatch = normalized.match(/^ubah(?: transaksi)?\s+(\S+)\s+(masuk|keluar)\s+(.+)$/i);
  if (updateMatch) {
    const parsedPayload = parseTransactionPayload(updateMatch[3]);

    if (!parsedPayload) {
      return {
        name: "unknown"
      };
    }

    return {
      name: "update_transaction",
      transactionId: updateMatch[1],
      type: updateMatch[2].toLowerCase() === "masuk" ? "income" : "expense",
      amount: parsedPayload.amount,
      category: parsedPayload.category,
      transactionDate: parsedPayload.transactionDate
    };
  }

  const deleteMatch = normalized.match(/^hapus(?: transaksi)?\s+(\S+)$/i);
  if (deleteMatch) {
    return {
      name: "delete_transaction",
      transactionId: deleteMatch[1]
    };
  }

  const confirmDeleteMatch = normalized.match(/^konfirmasi hapus(?: transaksi)?\s+(\S+)$/i);
  if (confirmDeleteMatch) {
    return {
      name: "confirm_delete_transaction",
      transactionId: confirmDeleteMatch[1]
    };
  }

  return {
    name: "unknown"
  };
}

function parseTransactionPayload(payload) {
  const payloadMatch = String(payload || "").trim().match(/^(.*?)(?:\s+tanggal\s+(\d{4}-\d{2}-\d{2}))?$/i);

  if (!payloadMatch) {
    return null;
  }

  const payloadWithoutDate = payloadMatch[1].trim();
  const transactionDate = payloadMatch[2] || undefined;
  const parts = payloadWithoutDate.split(" ").filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  for (let index = parts.length - 1; index >= 1; index -= 1) {
    const amount = parts.slice(0, index).join(" ");
    const category = parts.slice(index).join(" ").trim();

    if (Number.isFinite(parseAmount(amount)) && category) {
      return {
        amount,
        category,
        transactionDate
      };
    }
  }

  return null;
}

module.exports = {
  parseCommand
};
