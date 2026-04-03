const FinanceService = require("../services/financeService");
const { handleAppError } = require("../middlewares/errorHandler");
const logger = require("../utils/logger");
const { parseMessage } = require("../commands/parser");
const { formatCurrency, formatTransaction } = require("../utils/formatter");
const { buildHelpMessage } = require("../utils/messageTemplates");

class MessageController {
  constructor(financeService = new FinanceService()) {
    this.financeService = financeService;
  }

  async handle(context) {
    const command = parseMessage(context.text);

    logger.info("incoming_request", {
      correlationId: context.correlationId,
      userId: context.userId,
      chatId: context.chatId,
      rawText: context.text,
      command: command ? command.name : null
    });

    if (!command) {
      logger.warn("request_ignored", {
        correlationId: context.correlationId,
        userId: context.userId,
        reason: "EMPTY_MESSAGE"
      });
      return null;
    }

    try {
      const response = this.dispatchCommand(command, context);

      logger.info("outgoing_response", {
        correlationId: context.correlationId,
        userId: context.userId,
        command: command.name,
        responsePreview: response
      });

      return response;
    } catch (error) {
      return handleAppError(error, {
        correlationId: context.correlationId,
        userId: context.userId,
        command: command.name
      });
    }
  }

  dispatchCommand(command, context) {
    switch (command.name) {
      case "income": {
        const result = this.financeService.addIncome(context.userId, command.amount, command.category);
        return [
          `Pemasukan berhasil dicatat: ${formatTransaction(result.latestTransaction)}`,
          `Saldo sekarang: ${formatCurrency(result.balance)}`
        ].join("\n");
      }
      case "expense": {
        const result = this.financeService.addExpense(context.userId, command.amount, command.category);
        return [
          `Pengeluaran berhasil dicatat: ${formatTransaction(result.latestTransaction)}`,
          `Saldo sekarang: ${formatCurrency(result.balance)}`
        ].join("\n");
      }
      case "balance":
        return this.financeService.getBalanceMessage(context.userId);
      case "history":
        return this.financeService.getHistoryMessage(context.userId, command.filter);
      case "monthly_report":
        return this.financeService.getMonthlyReportMessage(
          context.userId,
          command.month || undefined
        );
      case "help":
        return buildHelpMessage();
      case "reset_request":
        return this.financeService.requestReset(context.userId);
      case "reset_confirm":
        return this.financeService.confirmReset(context.userId);
      case "reset_cancel":
        return this.financeService.cancelReset(context.userId);
      default:
        logger.warn("unknown_command", {
          correlationId: context.correlationId,
          userId: context.userId,
          rawText: context.text
        });
        return ["Perintah tidak dikenali.", "", buildHelpMessage()].join("\n");
    }
  }
}

module.exports = MessageController;
