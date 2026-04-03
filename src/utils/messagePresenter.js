const { formatCurrency, formatDate } = require("./formatter");

function buildHelpMessage() {
  return [
    "Daftar command yang tersedia:",
    "- help",
    "- masuk <nominal> <kategori>",
    "- keluar <nominal> <kategori>",
    "- saldo",
    "- riwayat",
    "- riwayat hari ini",
    "- riwayat bulan ini",
    "- riwayat kategori <nama-kategori>",
    "- laporan bulan ini",
    "- laporan YYYY-MM",
    "- reset",
    '- "ya reset"',
    '- "batal reset"',
    "",
    "Command admin:",
    "- admin stats",
    "- admin stats YYYY-MM",
    "- admin kategori",
    "- admin kategori YYYY-MM",
    "- admin user aktif",
    "- admin user aktif YYYY-MM"
  ].join("\n");
}

function formatTransactionCreated(result) {
  const action = result.transaction.type === "income" ? "Pemasukan" : "Pengeluaran";

  return [
    `${action} berhasil dicatat.`,
    `- Kategori: ${result.transaction.category}`,
    `- Nominal: ${formatCurrency(result.transaction.amount)}`,
    `- Saldo sekarang: ${formatCurrency(result.balance)}`,
    result.duplicate ? "- Status: request duplikat, transaksi lama digunakan." : null
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSummary(summary) {
  return [
    "Ringkasan saldo:",
    `- Saldo saat ini: ${formatCurrency(summary.balance)}`,
    `- Jumlah transaksi bulan ini: ${summary.stats.totalTransactions}`,
    `- Pemasukan bulan ini: ${formatCurrency(summary.stats.currentMonthIncome)}`,
    `- Pengeluaran bulan ini: ${formatCurrency(summary.stats.currentMonthExpense)}`
  ].join("\n");
}

function formatTransactionHistory(items, meta, filterDescription = "Riwayat transaksi") {
  if (!items.length) {
    return "Tidak ada transaksi yang cocok dengan filter tersebut.";
  }

  return [
    `${filterDescription}:`,
    ...items.map((transaction) => [
      `- ${transaction.type === "income" ? "Masuk" : "Keluar"} ${formatCurrency(transaction.amount)}`,
      `${transaction.category}`,
      `(${formatDate(transaction.createdAt)})`
    ].join(" | ")),
    "",
    `Menampilkan ${items.length} dari total ${meta.totalItems} transaksi.`
  ].join("\n");
}

function formatMonthlyReport(report) {
  return [
    `Laporan bulan ${report.month}:`,
    `- Total pemasukan: ${formatCurrency(report.totals.income)}`,
    `- Total pengeluaran: ${formatCurrency(report.totals.expense)}`,
    `- Selisih: ${formatCurrency(report.totals.net)}`,
    `- Total transaksi: ${report.totals.transactionCount}`,
    "",
    "Pemasukan per kategori:",
    formatBreakdown(report.incomeBreakdown, "Tidak ada pemasukan."),
    "",
    "Pengeluaran per kategori:",
    formatBreakdown(report.expenseBreakdown, "Tidak ada pengeluaran."),
    "",
    "Insight:",
    `- Pemasukan terbesar: ${formatInsight(report.insights.topIncomeCategory)}`,
    `- Pengeluaran terbesar: ${formatInsight(report.insights.topExpenseCategory)}`
  ].join("\n");
}

function formatAdminStats(stats) {
  return [
    `Global stats bulan ${stats.month}:`,
    `- Total user: ${stats.totals.users}`,
    `- Total admin: ${stats.totals.admins}`,
    `- Total transaksi: ${stats.totals.transactions}`,
    `- Volume transaksi: ${formatCurrency(stats.totals.transactionVolume)}`
  ].join("\n");
}

function formatTopCategories(result) {
  if (!result.items.length) {
    return `Tidak ada data kategori untuk ${result.month}.`;
  }

  return [
    `Top kategori ${result.type} bulan ${result.month}:`,
    ...result.items.map((item, index) => (
      `${index + 1}. ${item.category} - ${formatCurrency(item.amount)} (${item.count} transaksi)`
    ))
  ].join("\n");
}

function formatMostActiveUsers(result) {
  if (!result.items.length) {
    return `Tidak ada user aktif untuk ${result.month}.`;
  }

  return [
    `User paling aktif bulan ${result.month}:`,
    ...result.items.map((item, index) => (
      `${index + 1}. ${item.userId} - ${item.transactionCount} transaksi, saldo ${formatCurrency(item.balance)}`
    ))
  ].join("\n");
}

function formatResetResponse(result) {
  return result.message;
}

function formatDailySummary(payload) {
  return [
    `Ringkasan harian ${payload.date}:`,
    `- Total pemasukan: ${formatCurrency(payload.totals.income)}`,
    `- Total pengeluaran: ${formatCurrency(payload.totals.expense)}`,
    `- Selisih: ${formatCurrency(payload.totals.net)}`,
    `- Total transaksi: ${payload.totals.transactionCount}`,
    payload.topExpenseCategory
      ? `- Pengeluaran terbesar: ${payload.topExpenseCategory.category} (${formatCurrency(payload.topExpenseCategory.amount)})`
      : "- Pengeluaran terbesar: tidak ada"
  ].join("\n");
}

function formatBreakdown(items, emptyMessage) {
  if (!items.length) {
    return `- ${emptyMessage}`;
  }

  return items
    .map((item) => `- ${item.category}: ${formatCurrency(item.amount)} (${item.count} transaksi)`)
    .join("\n");
}

function formatInsight(item) {
  if (!item) {
    return "tidak ada";
  }

  return `${item.category} (${formatCurrency(item.amount)})`;
}

module.exports = {
  buildHelpMessage,
  formatAdminStats,
  formatDailySummary,
  formatMonthlyReport,
  formatMostActiveUsers,
  formatResetResponse,
  formatSummary,
  formatTopCategories,
  formatTransactionCreated,
  formatTransactionHistory
};
