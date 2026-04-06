const { formatCurrency, formatDate } = require("./formatter");

function buildLegacyHelpMessage() {
  return [
    "Hai, aku CatatDuit 👋",
    "Coba kirim salah satu format ini ya:",
    "",
    "Catat transaksi",
    "- masuk 50000 gaji",
    "- keluar 20000 makan",
    "",
    "Cek catatan",
    "- saldo",
    "- riwayat",
    "- riwayat hari ini",
    "- riwayat bulan ini",
    "- riwayat kategori makan",
    "- laporan bulan ini",
    "- laporan 2026-04",
    "",
    "Reset data",
    "- reset",
    "- ya reset",
    "- batal reset",
    "",
    "Menu admin",
    "- admin stats",
    "- admin stats 2026-04",
    "- admin kategori",
    "- admin kategori 2026-04",
    "- admin user aktif",
    "- admin user aktif 2026-04"
  ].join("\n");
}

function formatLegacyTransactionCreated(result) {
  const action = result.transaction.type === "income" ? "Pemasukan" : "Pengeluaran";
  const intro = result.transaction.type === "income"
    ? "Sip, pemasukan kamu sudah kecatat ✅"
    : "Sip, pengeluaran kamu sudah kecatat ✅";

  return [
    intro,
    `- ${action}: ${formatCurrency(result.transaction.amount)}`,
    `- Kategori: ${result.transaction.category}`,
    `- Saldo sekarang: ${formatCurrency(result.balance)}`,
    result.duplicate
      ? "Catatan yang sama sudah pernah masuk, jadi saldo tidak berubah."
      : "Kalau mau, lanjut cek `saldo` atau `riwayat`."
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSummary(summary) {
  return [
    "Ini ringkasan uang kamu saat ini 💸",
    `- Saldo sekarang: ${formatCurrency(summary.balance)}`,
    `- Transaksi bulan ini: ${summary.stats.totalTransactions}`,
    `- Total masuk: ${formatCurrency(summary.stats.currentMonthIncome)}`,
    `- Total keluar: ${formatCurrency(summary.stats.currentMonthExpense)}`,
    "Mau lanjut cek `riwayat` atau `laporan bulan ini`?"
  ].join("\n");
}

function formatLegacyTransactionHistory(items, meta, filterDescription = "Riwayat transaksi") {
  if (!items.length) {
    return [
      "Belum ada catatan yang cocok.",
      "Coba cek `riwayat` atau ganti filter ya."
    ].join("\n");
  }

  return [
    `${filterDescription} 👇`,
    ...items.map((transaction) => [
      `- ${transaction.type === "income" ? "Masuk" : "Keluar"} ${formatCurrency(transaction.amount)}`,
      `${transaction.category}`,
      `(${formatDate(transaction.createdAt)})`
    ].join(" | ")),
    "",
    `Ketemu ${items.length} dari total ${meta.totalItems} transaksi.`
  ].join("\n");
}

function formatMonthlyReport(report) {
  return [
    `Laporan bulan ${report.month} siap ✨`,
    `- Total masuk: ${formatCurrency(report.totals.income)}`,
    `- Total keluar: ${formatCurrency(report.totals.expense)}`,
    `- Selisih: ${formatCurrency(report.totals.net)}`,
    `- Total transaksi: ${report.totals.transactionCount}`,
    "",
    "Rincian pemasukan:",
    formatBreakdown(report.incomeBreakdown, "Belum ada pemasukan."),
    "",
    "Rincian pengeluaran:",
    formatBreakdown(report.expenseBreakdown, "Belum ada pengeluaran."),
    "",
    "Highlight bulan ini:",
    `- Pemasukan terbesar: ${formatInsight(report.insights.topIncomeCategory)}`,
    `- Pengeluaran terbesar: ${formatInsight(report.insights.topExpenseCategory)}`
  ].join("\n");
}

function formatAdminStats(stats) {
  return [
    `Ringkasan global bulan ${stats.month}:`,
    `- Total user: ${stats.totals.users}`,
    `- Total admin: ${stats.totals.admins}`,
    `- Total transaksi: ${stats.totals.transactions}`,
    `- Volume transaksi: ${formatCurrency(stats.totals.transactionVolume)}`
  ].join("\n");
}

function formatTopCategories(result) {
  if (!result.items.length) {
    return `Belum ada data kategori untuk ${result.month}.`;
  }

  const typeLabel = result.type === "expense"
    ? "pengeluaran"
    : result.type === "income"
      ? "pemasukan"
      : "transaksi";

  return [
    `Top kategori ${typeLabel} bulan ${result.month}:`,
    ...result.items.map((item, index) => (
      `${index + 1}. ${item.category} - ${formatCurrency(item.amount)} (${item.count} transaksi)`
    ))
  ].join("\n");
}

function formatMostActiveUsers(result) {
  if (!result.items.length) {
    return `Belum ada user aktif untuk ${result.month}.`;
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
    `- Total masuk: ${formatCurrency(payload.totals.income)}`,
    `- Total keluar: ${formatCurrency(payload.totals.expense)}`,
    `- Selisih: ${formatCurrency(payload.totals.net)}`,
    `- Total transaksi: ${payload.totals.transactionCount}`,
    payload.topExpenseCategory
      ? `- Pengeluaran terbesar: ${payload.topExpenseCategory.category} (${formatCurrency(payload.topExpenseCategory.amount)})`
      : "- Pengeluaran terbesar: belum ada"
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
    return "belum ada";
  }

  return `${item.category} (${formatCurrency(item.amount)})`;
}

function buildHelpMessage({ isAdmin = false } = {}) {
  const lines = [
    "Hai, aku CatatDuit.",
    "Coba kirim salah satu format ini ya:",
    "",
    "Catat transaksi",
    "- masuk 50000 gaji",
    "- keluar 20000 makan",
    "- masuk 50000 gaji tanggal 2026-04-05",
    "- keluar 20000 makan tanggal 2026-04-05",
    "- ubah <id> keluar 25000 makan tanggal 2026-04-05",
    "- hapus <id>",
    "- konfirmasi hapus <id>",
    "",
    "Cek catatan",
    "- saldo",
    "- riwayat",
    "- riwayat hari ini",
    "- riwayat bulan ini",
    "- riwayat detail <id>",
    "- riwayat 2026-04-01 sampai 2026-04-05",
    "- riwayat kategori makan",
    "- laporan bulan ini",
    "- laporan 2026-04",
    "",
    "Reset data",
    "- reset",
    "- ya reset",
    "- batal reset"
  ];

  if (isAdmin) {
    lines.push(
      "",
      "Menu admin",
      "- admin stats",
      "- admin stats 2026-04",
      "- admin kategori",
      "- admin kategori 2026-04",
      "- admin user aktif",
      "- admin user aktif 2026-04"
    );
  }

  return lines.join("\n");
}

function buildUserHelpMessage() {
  return buildHelpMessage({ isAdmin: false });
}

function buildAdminHelpMessage() {
  return buildHelpMessage({ isAdmin: true });
}

function formatTransactionCreated(result) {
  const action = result.transaction.type === "income" ? "Pemasukan" : "Pengeluaran";
  const intro = result.transaction.type === "income"
    ? "Sip, pemasukan kamu sudah kecatat."
    : "Sip, pengeluaran kamu sudah kecatat.";

  return [
    intro,
    `- ${action}: ${formatCurrency(result.transaction.amount)}`,
    `- Kategori: ${result.transaction.category}`,
    result.transaction.transactionAt
      ? `- Tanggal transaksi: ${formatDate(result.transaction.transactionAt)}`
      : null,
    `- Saldo sekarang: ${formatCurrency(result.balance)}`,
    result.duplicate
      ? "Catatan yang sama sudah pernah masuk, jadi saldo tidak berubah."
      : "Kalau mau, lanjut cek `saldo` atau `riwayat`."
  ]
    .filter(Boolean)
    .join("\n");
}

function formatTransactionUpdated(result) {
  const action = result.transaction.type === "income" ? "Pemasukan" : "Pengeluaran";

  return [
    "Siap, transaksinya sudah diperbarui.",
    `- ID: ${result.transaction._id}`,
    `- ${action}: ${formatCurrency(result.transaction.amount)}`,
    `- Kategori: ${result.transaction.category}`,
    result.transaction.transactionAt
      ? `- Tanggal transaksi: ${formatDate(result.transaction.transactionAt)}`
      : null,
    `- Saldo sekarang: ${formatCurrency(result.balance)}`
  ]
    .filter(Boolean)
    .join("\n");
}

function formatTransactionDeleted(result) {
  const action = result.transaction.type === "income" ? "Pemasukan" : "Pengeluaran";

  return [
    "Siap, transaksinya sudah dihapus.",
    `- ID: ${result.transaction._id}`,
    `- ${action}: ${formatCurrency(result.transaction.amount)}`,
    `- Kategori: ${result.transaction.category}`,
    `- Saldo sekarang: ${formatCurrency(result.balance)}`
  ].join("\n");
}

function formatTransactionDeleteRequested(result) {
  const action = result.transaction.type === "income" ? "Pemasukan" : "Pengeluaran";

  return [
    "Penghapusan belum dijalankan.",
    `- ID: ${result.transaction._id}`,
    `- ${action}: ${formatCurrency(result.transaction.amount)}`,
    `- Kategori: ${result.transaction.category}`,
    "Kalau memang yakin, kirim:",
    `konfirmasi hapus ${result.transaction._id}`
  ].join("\n");
}

function formatTransactionDetail(result) {
  const action = result.transaction.type === "income" ? "Pemasukan" : "Pengeluaran";

  return [
    "Detail transaksi:",
    `- ID: ${result.transaction._id}`,
    `- Jenis: ${action}`,
    `- Nominal: ${formatCurrency(result.transaction.amount)}`,
    `- Kategori: ${result.transaction.category}`,
    result.transaction.transactionAt
      ? `- Tanggal transaksi: ${formatDate(result.transaction.transactionAt)}`
      : null,
    result.transaction.createdAt
      ? `- Dicatat pada: ${formatDate(result.transaction.createdAt)}`
      : null,
    `- Saldo saat ini: ${formatCurrency(result.balance)}`,
    "",
    `Kalau mau ubah, kirim \`ubah ${result.transaction._id} ${result.transaction.type === "income" ? "masuk" : "keluar"} ${result.transaction.amount} ${result.transaction.category}\`.`,
    `Kalau mau hapus, kirim \`hapus ${result.transaction._id}\`, lalu lanjutkan dengan \`konfirmasi hapus ${result.transaction._id}\`.`
  ]
    .filter(Boolean)
    .join("\n");
}

function formatTransactionHistory(items, meta, filterDescription = "Riwayat transaksi") {
  if (!items.length) {
    return [
      "Belum ada catatan yang cocok.",
      "Coba cek `riwayat` atau ganti filter ya."
    ].join("\n");
  }

  return [
    `${filterDescription}:`,
    ...items.map((transaction) => [
      `- ID ${transaction._id}`,
      `- ${transaction.type === "income" ? "Masuk" : "Keluar"} ${formatCurrency(transaction.amount)}`,
      `${transaction.category}`,
      `(${formatDate(transaction.transactionAt || transaction.createdAt)})`
    ].join(" | ")),
    "",
    `Ketemu ${items.length} dari total ${meta.totalItems} transaksi.`
  ].join("\n");
}

module.exports = {
  buildAdminHelpMessage,
  buildHelpMessage,
  buildUserHelpMessage,
  formatAdminStats,
  formatDailySummary,
  formatMonthlyReport,
  formatMostActiveUsers,
  formatResetResponse,
  formatSummary,
  formatTopCategories,
  formatTransactionCreated,
  formatTransactionDeleteRequested,
  formatTransactionDetail,
  formatTransactionDeleted,
  formatTransactionHistory
  ,
  formatTransactionUpdated
};
