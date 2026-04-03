function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatTransaction(transaction) {
  const label = transaction.type === "income" ? "Masuk" : "Keluar";
  return [
    `#${transaction.id}`,
    label,
    formatCurrency(transaction.amount),
    `- kategori: ${transaction.category}`,
    `(${formatDate(transaction.createdAt)})`
  ].join(" ");
}

function formatCategoryBreakdown(breakdown, emptyMessage = "Tidak ada data kategori.") {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return `- ${emptyMessage}`;
  }

  return entries
    .map(([category, total]) => `- ${category}: ${formatCurrency(total)}`)
    .join("\n");
}

module.exports = {
  formatCurrency,
  formatDate,
  formatTransaction,
  formatCategoryBreakdown
};
