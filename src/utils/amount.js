function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : Number.NaN;
  }

  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

  if (!normalized) {
    return Number.NaN;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (/^\d{1,3}([.,]\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/[.,]/g, ""));
  }

  const multiplierMatch = normalized.match(/^([\d.,]+)\s*(ribu|rb|juta|jt)$/i);
  if (multiplierMatch) {
    const baseAmount = parseScaledAmount(multiplierMatch[1]);
    const multiplier = {
      ribu: 1_000,
      rb: 1_000,
      juta: 1_000_000,
      jt: 1_000_000
    }[multiplierMatch[2].toLowerCase()];
    const scaledAmount = baseAmount * multiplier;

    return Number.isInteger(scaledAmount) && scaledAmount > 0
      ? scaledAmount
      : Number.NaN;
  }

  return Number.NaN;
}

function parseScaledAmount(value) {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (/^\d{1,3}([.,]\d{3})+$/.test(value)) {
    return Number(value.replace(/[.,]/g, ""));
  }

  if (/^\d+[.,]\d+$/.test(value)) {
    return Number(value.replace(",", "."));
  }

  return Number.NaN;
}

module.exports = {
  parseAmount
};
