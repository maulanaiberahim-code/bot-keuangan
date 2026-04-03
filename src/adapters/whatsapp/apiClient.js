const AppError = require("../../errors/AppError");
const env = require("../../config/env");

class WhatsAppApiClient {
  async request({ method, path, body, query, correlationId, commandName }) {
    try {
      const url = new URL(`${env.whatsappApiBaseUrl}${path}`);

      if (query) {
        Object.entries(query)
          .filter(([, value]) => value !== undefined && value !== null && value !== "")
          .forEach(([key, value]) => {
            url.searchParams.set(key, value);
          });
      }

      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          "x-api-key": env.apiKey,
          "x-correlation-id": correlationId,
          "x-command-name": commandName
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new AppError(
          payload.error?.message || "Gagal memanggil API inti.",
          response.status,
          payload.error?.code || "API_REQUEST_FAILED",
          payload.error?.details || {}
        );
      }

      return payload.data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Adapter gagal terhubung ke API inti.", 502, "API_UNREACHABLE");
    }
  }
}

module.exports = WhatsAppApiClient;
