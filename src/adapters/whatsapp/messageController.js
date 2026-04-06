const env = require("../../config/env");
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
  formatTransactionDeleteRequested,
  formatTransactionDetail,
  formatTransactionDeleted,
  formatTransactionHistory
  ,
  formatTransactionUpdated
} = require("../../utils/messagePresenter");
const { parseCommand } = require("./commandParser");
const AppError = require("../../errors/AppError");

class WhatsAppMessageController {
  constructor({ apiClient, logger, adminUserIds = env.adminUserIds }) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.adminUserIds = new Set(adminUserIds);
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
        return [
          `Ups, ${error.message}`,
          "Coba cek format pesanmu lalu kirim lagi ya."
        ].join("\n");
      }

      return "Lagi ada kendala di sistem. Coba sebentar lagi ya 🙏";
    }
  }

  async dispatch(command, context) {
    const isAdmin = this.isAdminUser(context.userId);

    switch (command.name) {
      case "help":
        return buildHelpMessage({ isAdmin });
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
            transactionDate: command.transactionDate,
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
            transactionDate: command.transactionDate,
            source: "whatsapp",
            idempotencyKey: `${context.chatId}:${context.messageId || context.correlationId}`
          }
        });

        return formatTransactionCreated(result);
      }
      case "update_transaction": {
        const result = await this.apiClient.request({
          method: "PATCH",
          path: `/transactions/${command.transactionId}`,
          correlationId: context.correlationId,
          commandName: command.name,
          body: {
            userId: context.userId,
            chatId: context.chatId,
            type: command.type,
            amount: command.amount,
            category: command.category,
            transactionDate: command.transactionDate
          }
        });

        return formatTransactionUpdated(result);
      }
      case "delete_transaction": {
        const result = await this.apiClient.request({
          method: "POST",
          path: `/transactions/${command.transactionId}/delete-request`,
          correlationId: context.correlationId,
          commandName: command.name,
          body: {
            userId: context.userId,
            chatId: context.chatId
          }
        });

        return formatTransactionDeleteRequested(result);
      }
      case "confirm_delete_transaction": {
        const result = await this.apiClient.request({
          method: "POST",
          path: `/transactions/${command.transactionId}/delete-confirm`,
          correlationId: context.correlationId,
          commandName: command.name,
          body: {
            userId: context.userId,
            chatId: context.chatId
          }
        });

        return result.status === "completed"
          ? formatTransactionDeleted(result)
          : result.message;
      }
      case "transaction_detail": {
        const result = await this.apiClient.request({
          method: "GET",
          path: `/transactions/${command.transactionId}`,
          correlationId: context.correlationId,
          commandName: command.name,
          query: {
            userId: context.userId,
            chatId: context.chatId
          }
        });

        return formatTransactionDetail(result);
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
            fromDateKey: command.filter.fromDateKey,
            toDateKey: command.filter.toDateKey,
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
        return [
          "Aku belum paham format pesan itu 🙏",
          "Coba pakai salah satu format di bawah ya:",
          "",
          buildHelpMessage({ isAdmin })
        ].join("\n");
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

  isAdminUser(userId) {
    const normalizedUserId = String(userId || "").replace(/[^\d]/g, "").trim();
    return this.adminUserIds.has(normalizedUserId);
  }
}

function buildHistoryTitle(filter = {}) {
  if (filter.fromDateKey && filter.toDateKey) {
    return `Riwayat ${filter.fromDateKey} sampai ${filter.toDateKey}`;
  }

  if (filter.period === "today") {
    return "Riwayat hari ini";
  }

  if (filter.period === "month") {
    return "Riwayat bulan ini";
  }

  if (filter.category) {
    return `Riwayat kategori ${filter.category}`;
  }

  return "Riwayat transaksi";
}

module.exports = WhatsAppMessageController;
