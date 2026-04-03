const fs = require("fs");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const logger = require("./utils/logger");
const MessageController = require("./controllers/messageController");
const { AUTH_DIR } = require("./config/paths");
const env = require("./config/env");
const { generateCorrelationId } = require("./utils/correlationId");
const { normalizeUserId } = require("./utils/user");

const messageController = new MessageController();
let activeSocket = null;
let isReconnecting = false;
let reconnectTimer = null;

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

async function startBot() {
  if (activeSocket) {
    return activeSocket;
  }

  logger.info("Starting WhatsApp finance bot", {
    botName: env.botName,
    authDir: AUTH_DIR
  });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    logger: pino({ level: "silent" })
  });
  activeSocket = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      logger.info("QR code generated. Scan with WhatsApp.");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      isReconnecting = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      logger.info("WhatsApp connection opened successfully");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const isActiveSocket = activeSocket === sock;

      if (isActiveSocket) {
        activeSocket = null;
      }

      logger.warn("WhatsApp connection closed", {
        statusCode,
        shouldReconnect
      });

      if (shouldReconnect && !isReconnecting && isActiveSocket) {
        isReconnecting = true;
        reconnectTimer = setTimeout(() => {
          startBot()
            .catch((error) => {
              isReconnecting = false;
              logger.error("Failed to reconnect bot", {
                error: error.message,
                stack: error.stack
              });
            })
            .finally(() => {
              reconnectTimer = null;
            });
        }, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") {
      return;
    }

    for (const message of messages) {
      let chatId = null;
      let senderId = null;
      let userId = null;
      let correlationId = null;
      let text = null;

      try {
        if (!message.message || message.key.fromMe) {
          continue;
        }

        chatId = message.key.remoteJid;
        senderId = message.key.participant || chatId;
        userId = normalizeUserId(senderId);
        text = extractMessageText(message.message);
        correlationId = generateCorrelationId();

        if (!text || !userId) {
          continue;
        }

        const reply = await messageController.handle({
          chatId,
          senderId,
          userId,
          correlationId,
          text
        });

        if (reply) {
          await sock.sendMessage(chatId, { text: reply });
        }
      } catch (error) {
        logger.error("Failed to process incoming WhatsApp message", {
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
}

function extractMessageText(messageContent) {
  return (
    messageContent.conversation ||
    messageContent.extendedTextMessage?.text ||
    messageContent.imageMessage?.caption ||
    messageContent.videoMessage?.caption ||
    ""
  ).trim();
}

process.on("SIGINT", () => {
  logger.warn("Application received SIGINT. Shutting down.");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.warn("Application received SIGTERM. Shutting down.");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: String(reason)
  });
});

startBot().catch((error) => {
  logger.error("Failed to start bot", {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
