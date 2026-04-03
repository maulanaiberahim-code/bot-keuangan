const { getCurrentDayKey, getCurrentMonthKey, getLocalDateParts } = require("../utils/dateHelper");

class ReportScheduler {
  constructor({ financeService, logger, metrics }) {
    this.financeService = financeService;
    this.logger = logger;
    this.metrics = metrics;
  }

  async enqueueDailyReports(dateKey = getCurrentDayKey()) {
    const users = await this.financeService.getDeliverableUsers();

    for (const user of users) {
      const transactions = await this.financeService.getExportTransactions({
        userId: user.userId,
        fromDateKey: dateKey,
        toDateKey: dateKey
      });

      const payload = buildDailyPayload(dateKey, transactions);

      await this.financeService.queueScheduledReport({
        userId: user.userId,
        chatId: user.lastKnownChatId,
        reportType: "daily",
        periodKey: dateKey,
        payload
      });

      this.metrics.schedulerJobsTotal.inc({
        report_type: "daily",
        status: "queued"
      });
    }

    this.logger.info("daily_reports_queued", {
      dateKey,
      totalUsers: users.length
    });
  }

  async enqueueMonthlyReports(monthKey = getPreviousMonthKey()) {
    const users = await this.financeService.getDeliverableUsers();

    for (const user of users) {
      const report = await this.financeService.getMonthlyReport({
        userId: user.userId,
        monthKey,
        chatId: user.lastKnownChatId
      });

      await this.financeService.queueScheduledReport({
        userId: user.userId,
        chatId: user.lastKnownChatId,
        reportType: "monthly",
        periodKey: monthKey,
        payload: report
      });

      this.metrics.schedulerJobsTotal.inc({
        report_type: "monthly",
        status: "queued"
      });
    }

    this.logger.info("monthly_reports_queued", {
      monthKey,
      totalUsers: users.length
    });
  }
}

function buildDailyPayload(dateKey, transactions) {
  const incomeTransactions = transactions.filter((item) => item.type === "income");
  const expenseTransactions = transactions.filter((item) => item.type === "expense");
  const topExpenseCategory = buildBreakdown(expenseTransactions)[0] || null;

  return {
    date: dateKey,
    totals: {
      income: sumTransactions(incomeTransactions),
      expense: sumTransactions(expenseTransactions),
      net: sumTransactions(incomeTransactions) - sumTransactions(expenseTransactions),
      transactionCount: transactions.length
    },
    topExpenseCategory
  };
}

function buildBreakdown(transactions) {
  const categoryMap = transactions.reduce((accumulator, transaction) => {
    const current = accumulator[transaction.category] || {
      category: transaction.category,
      amount: 0
    };
    current.amount += transaction.amount;
    accumulator[transaction.category] = current;
    return accumulator;
  }, {});

  return Object.values(categoryMap).sort((a, b) => b.amount - a.amount);
}

function sumTransactions(transactions) {
  return transactions.reduce((sum, item) => sum + item.amount, 0);
}

function getPreviousMonthKey(referenceDate = new Date()) {
  const local = getLocalDateParts(referenceDate);
  const date = new Date(`${local.year}-${local.month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return getLocalDateParts(date).monthKey;
}

module.exports = ReportScheduler;
