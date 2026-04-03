const { isValidMonthKey } = require("../../utils/dateHelper");

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

  const incomeMatch = normalized.match(/^masuk\s+([0-9.,]+)\s+(.+)$/i);
  if (incomeMatch) {
    return {
      name: "income",
      amount: incomeMatch[1],
      category: incomeMatch[2].trim()
    };
  }

  const expenseMatch = normalized.match(/^keluar\s+([0-9.,]+)\s+(.+)$/i);
  if (expenseMatch) {
    return {
      name: "expense",
      amount: expenseMatch[1],
      category: expenseMatch[2].trim()
    };
  }

  return {
    name: "unknown"
  };
}

module.exports = {
  parseCommand
};
