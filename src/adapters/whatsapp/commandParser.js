const { isValidDayKey, isValidMonthKey } = require("../../utils/dateHelper");

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

  const incomeMatch = normalized.match(/^masuk\s+([0-9.,]+)\s+(.+?)(?:\s+tanggal\s+(\d{4}-\d{2}-\d{2}))?$/i);
  if (incomeMatch) {
    return {
      name: "income",
      amount: incomeMatch[1],
      category: incomeMatch[2].trim(),
      transactionDate: incomeMatch[3] || null
    };
  }

  const expenseMatch = normalized.match(/^keluar\s+([0-9.,]+)\s+(.+?)(?:\s+tanggal\s+(\d{4}-\d{2}-\d{2}))?$/i);
  if (expenseMatch) {
    return {
      name: "expense",
      amount: expenseMatch[1],
      category: expenseMatch[2].trim(),
      transactionDate: expenseMatch[3] || null
    };
  }

  const updateMatch = normalized.match(/^ubah(?: transaksi)?\s+(\S+)\s+(masuk|keluar)\s+([0-9.,]+)\s+(.+?)(?:\s+tanggal\s+(\d{4}-\d{2}-\d{2}))?$/i);
  if (updateMatch) {
    return {
      name: "update_transaction",
      transactionId: updateMatch[1],
      type: updateMatch[2].toLowerCase() === "masuk" ? "income" : "expense",
      amount: updateMatch[3],
      category: updateMatch[4].trim(),
      transactionDate: updateMatch[5] || undefined
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

module.exports = {
  parseCommand
};
