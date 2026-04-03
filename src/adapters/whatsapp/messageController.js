const { getCurrentMonthKey } = require("../../utils/dateHelper");
const {
  buildHelpMessage,
  formatAdminStats,
  formatMonthlyReport,
  formatMostActiveUsers,
  formatResetResponse,
  formatSummary,
  formatTopCategories,
  formatTransactionCreated,
  formatTransactionHistory
} = require("../../utils/messagePresenter");
const { parseCommand } = require("./commandParser");
const AppError = require("../../errors/AppError");

class WhatsAppMessageController {
  constructor({ apiClient, logger }) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  async handle(context) {
    const command = parseCommand(context.text);

    this.logger.info("whatsapp_incoming_message", {
      correlationId: context.correlationId,
      userId: context.userId,
      chatId: context.chatId,
      command: command ? command.name : null,
      text: context.text
    });

    if (!command) {
      return null;
    }

    try {
      const response = await this.dispatch(command, context);

      this.logger.info("whatsapp_outgoing_message", {
        correlationId: context.correlationId,
        userId: context.userId,
        command: command.name,
        responsePreview: response
      });

      return response;
    } catch (error) {
      this.logger.error("whatsapp_command_failed", {
        correlationId: context.correlationId,
        userId: context.userId,
        chatId: context.chatId,
        command: command.name,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof AppError) {
        return `Terjadi kesalahan: ${error.message}`;
      }

      return "Terjadi kesalahan internal.";
    }
  }

  async dispatch(command, context) {
    switch (command.name) {
      case "help":
        return buildHelpMessage();
      case "income": {
        const result = await this.apiClient.request({
          method: "POST",
          path: "/transactions",
          correlationId: context.correlationId,
          commandName: command.name,
          body: {
            userId: context.userId,
            chatId: context.chatId,
            type: "income",
            amount: command.amount,
            category: command.category,
            source: "whatsapp",
            idempotencyKey: `${context.chatId}:${context.messageId || context.correlationId}`
          }
        });

        return formatTransactionCreated(result);
      }
      case "expense": {
        const result = await this.apiClient.request({
          method: "POST",
          path: "/transactions",
          correlationId: context.correlationId,
          commandName: command.name,
          body: {
            userId: context.userId,
            chatId: context.chatId,
            type: "expense",
            amount: command.amount,
            category: command.category,
            source: "whatsapp",
            idempotencyKey: `${context.chatId}:${context.messageId || context.correlationId}`
          }
        });

        return formatTransactionCreated(result);
      }
      case "summary": {
        const result = await this.apiClient.request({
          method: "GET",
          path: "/summary",
          correlationId: context.correlationId,
          commandName: command.name,
          query: {
            userId: context.userId,
            chatId: context.chatId
          }
        });

        return formatSummary(result);
      }
      case "history": {
        const result = await this.apiClient.request({
          method: "GET",
          path: "/transactions",
          correlationId: context.correlationId,
          commandName: command.name,
          query: {
            userId: context.userId,
            period: command.filter.period,
            category: command.filter.category,
            limit: 10
          }
        });

        return formatTransactionHistory(
          result,
          { totalItems: result.length },
          buildHistoryTitle(command.filter)
        );
      }
      case "monthly_report": {
        const result = await this.apiClient.request({
          method: "GET",
          path: "/reports/monthly",
          correlationId: context.correlationId,
          commandName: command.name,
          query: {
            userId: context.userId,
            month: command.month || getCurrentMonthKey()
          }
        });

        return formatMonthlyReport(result);
      }
      case "reset_request":
        return this.handleReset("/resets/request", command, context);
      case "reset_confirm":
        return this.handleReset("/resets/confirm", command, context);
      case "reset_cancel":
        return this.handleReset("/resets/cancel", command, context);
      case "admin_stats": {
        const result = await this.apiClient.request({
          method: "GET",
          path: "/admin/stats",
          correlationId: context.correlationId,
          commandName: command.name,
          query: {
            userId: context.userId,
            month: command.month || undefined
          }
        });

        return formatAdminStats(result);
      }
      case "admin_top_categories": {
        const result = await this.apiClient.request({
          method: "GET",
          path: "/admin/categories/top",
          correlationId: context.correlationId,
          commandName: command.name,
          query: {
            userId: context.userId,
            month: command.month || getCurrentMonthKey(),
            type: "expense"
          }
        });

        return formatTopCategories(result);
      }
      case "admin_active_users": {
        const result = await this.apiClient.request({
          method: "GET",
          path: "/admin/users/active",
          correlationId: context.correlationId,
          commandName: command.name,
          query: {
            userId: context.userId,
            month: command.month || undefined
          }
        });

        return formatMostActiveUsers(result);
      }
      default:
        return ["Perintah tidak dikenali.", "", buildHelpMessage()].join("\n");
    }
  }

  async handleReset(path, command, context) {
    const result = await this.apiClient.request({
      method: "POST",
      path,
      correlationId: context.correlationId,
      commandName: command.name,
      body: {
        userId: context.userId,
        chatId: context.chatId
      }
    });

    return formatResetResponse(result);
  }
}

function buildHistoryTitle(filter = {}) {
  if (filter.period === "today") {
    return "Riwayat transaksi hari ini";
  }

  if (filter.period === "month") {
    return "Riwayat transaksi bulan ini";
  }

  if (filter.category) {
    return `Riwayat kategori ${filter.category}`;
  }

  return "Riwayat transaksi";
}

module.exports = WhatsAppMessageController;
