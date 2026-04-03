const AppError = require("../errors/AppError");
const env = require("../config/env");

class DeliveryGateway {
  async sendText({ chatId, text, correlationId }) {
    try {
      const response = await fetch(`${env.whatsappAdapterBaseUrl}/internal/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": env.internalAdapterToken,
          "x-correlation-id": correlationId
        },
        body: JSON.stringify({
          chatId,
          text
        })
      });

      if (!response.ok) {
        throw new AppError("Gagal mengirim pesan ke adapter WhatsApp.", 502, "DELIVERY_FAILED");
      }

      return response.json();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Adapter WhatsApp tidak dapat dijangkau.", 502, "ADAPTER_UNREACHABLE");
    }
  }
}

module.exports = DeliveryGateway;
