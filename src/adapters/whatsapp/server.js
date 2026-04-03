const express = require("express");
const env = require("../../config/env");
const logger = require("../../utils/logger");
const { normalizeUserId } = require("../../utils/user");
const { generateCorrelationId } = require("../../utils/correlationId");
const internalTokenAuth = require("../../http/middlewares/internalTokenAuth");
const WhatsAppApiClient = require("./apiClient");
const WhatsAppMessageController = require("./messageController");
const WhatsAppGateway = require("./whatsappGateway");

async function startAdapter() {
  const gateway = new WhatsAppGateway({ logger });
  const controller = new WhatsAppMessageController({
    apiClient: new WhatsAppApiClient(),
    logger
  });

  await gateway.start({
    onMessage: async (message) => {
      let chatId = null;
      let senderId = null;
      let userId = null;
      let text = null;
      let correlationId = null;

      try {
        if (!message.message || message.key.fromMe) {
          return;
        }

        chatId = message.key.remoteJid;
        senderId = message.key.participant || chatId;
        userId = normalizeUserId(senderId);
        text = gateway.extractText(message.message);
        correlationId = generateCorrelationId();

        if (!text || !userId) {
          return;
        }

        const reply = await controller.handle({
          chatId,
          senderId,
          userId,
          correlationId,
          messageId: message.key.id,
          text
        });

        if (reply) {
          await gateway.sendText(chatId, reply);
        }
      } catch (error) {
        logger.error("whatsapp_message_processing_failed", {
          chatId,
          senderId,
          userId,
          correlationId,
          text,
          error: error.message,
          stack: error.stack
        });
      }
    }
  });

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: "bot-keuangan-whatsapp-adapter",
        status: "ok"
      }
    });
  });

  app.post(
    "/internal/messages",
    internalTokenAuth({ token: env.internalAdapterToken }),
    async (req, res) => {
      try {
        if (!req.body?.chatId || !req.body?.text) {
          return res.status(400).json({
            success: false,
            error: {
              code: "INVALID_DELIVERY_PAYLOAD",
              message: "chatId dan text wajib diisi."
            }
          });
        }

        await gateway.sendText(req.body.chatId, req.body.text);
        return res.status(200).json({
          success: true,
          data: {
            delivered: true
          }
        });
      } catch (error) {
        logger.error("whatsapp_internal_delivery_failed", {
          error: error.message,
          stack: error.stack
        });

        return res.status(500).json({
          success: false,
          error: {
            code: "WHATSAPP_DELIVERY_FAILED",
            message: "Gagal mengirim pesan lewat adapter WhatsApp."
          }
        });
      }
    }
  );

  app.listen(env.whatsappAdapterPort, () => {
    logger.info("whatsapp_adapter_started", {
      port: env.whatsappAdapterPort
    });
  });
}

startAdapter().catch((error) => {
  logger.error("whatsapp_adapter_failed", {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
