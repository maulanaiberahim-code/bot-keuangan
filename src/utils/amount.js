function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : Number.NaN;
  }

  const normalized = String(value || "").trim();

  if (!normalized) {
    return Number.NaN;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (/^\d{1,3}([.,]\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/[.,]/g, ""));
  }

  return Number.NaN;
}

module.exports = {
  parseAmount
};
