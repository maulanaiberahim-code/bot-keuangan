function parseAmount(rawAmount) {
  const digitsOnly = String(rawAmount).replace(/[^\d]/g, "");
  return Number(digitsOnly);
}

function parseMessage(text) {
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const lowerText = normalized.toLowerCase();

  if (lowerText === "saldo") {
    return { name: "balance", raw: normalized };
  }

  if (lowerText === "help") {
    return { name: "help", raw: normalized };
  }

  if (lowerText === "riwayat") {
    return { name: "history", filter: { type: "all" }, raw: normalized };
  }

  if (lowerText === "riwayat hari ini") {
    return { name: "history", filter: { type: "today" }, raw: normalized };
  }

  if (lowerText === "riwayat bulan ini") {
    return { name: "history", filter: { type: "month" }, raw: normalized };
  }

  const historyCategoryMatch = normalized.match(/^riwayat kategori\s+(.+)$/i);
  if (historyCategoryMatch) {
    return {
      name: "history",
      filter: {
        type: "category",
        category: historyCategoryMatch[1].trim().toLowerCase()
      },
      raw: normalized
    };
  }

  if (lowerText === "laporan bulan ini") {
    return { name: "monthly_report", month: null, raw: normalized };
  }

  const monthReportMatch = normalized.match(/^laporan\s+(\d{4}-\d{2})$/i);
  if (monthReportMatch) {
    return { name: "monthly_report", month: monthReportMatch[1], raw: normalized };
  }

  if (lowerText === "reset") {
    return { name: "reset_request", raw: normalized };
  }

  if (lowerText === "ya reset") {
    return { name: "reset_confirm", raw: normalized };
  }

  if (lowerText === "batal reset") {
    return { name: "reset_cancel", raw: normalized };
  }

  const incomeMatch = normalized.match(/^masuk\s+([\d.,]+)\s+(.+)$/i);
  if (incomeMatch) {
    return {
      name: "income",
      amount: parseAmount(incomeMatch[1]),
      category: incomeMatch[2].trim(),
      raw: normalized
    };
  }

  const expenseMatch = normalized.match(/^keluar\s+([\d.,]+)\s+(.+)$/i);
  if (expenseMatch) {
    return {
      name: "expense",
      amount: parseAmount(expenseMatch[1]),
      category: expenseMatch[2].trim(),
      raw: normalized
    };
  }

  return { name: "unknown", raw: normalized };
}

module.exports = {
  parseMessage
};
