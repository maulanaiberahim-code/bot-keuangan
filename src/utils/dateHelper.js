const env = require("../config/env");

function getLocalDateParts(dateInput = new Date()) {
  const date = new Date(dateInput);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    dateKey: `${map.year}-${map.month}-${map.day}`,
    monthKey: `${map.year}-${map.month}`
  };
}

function matchesDay(dateString, dayKey) {
  return getLocalDateParts(dateString).dateKey === dayKey;
}

function matchesMonth(dateString, monthKey) {
  return getLocalDateParts(dateString).monthKey === monthKey;
}

function getCurrentDayKey() {
  return getLocalDateParts().dateKey;
}

function getCurrentMonthKey() {
  return getLocalDateParts().monthKey;
}

function isValidDayKey(dayKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return false;
  }

  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidMonthKey(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return false;
  }

  const [, month] = monthKey.split("-");
  const numericMonth = Number(month);
  return numericMonth >= 1 && numericMonth <= 12;
}

module.exports = {
  getCurrentDayKey,
  getCurrentMonthKey,
  getLocalDateParts,
  isValidDayKey,
  isValidMonthKey,
  matchesDay,
  matchesMonth
};
