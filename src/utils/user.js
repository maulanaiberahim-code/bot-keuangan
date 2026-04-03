function normalizeUserId(senderId) {
  return String(senderId || "")
    .replace(/[^0-9]/g, "")
    .trim();
}

module.exports = {
  normalizeUserId
};
