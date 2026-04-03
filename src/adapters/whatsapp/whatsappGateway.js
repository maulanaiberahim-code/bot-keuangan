const fs = require("fs");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const { AUTH_DIR } = require("../../config/paths");

class WhatsAppGateway {
  constructor({ logger }) {
    this.logger = logger;
    this.activeSocket = null;
    this.isReconnecting = false;
    this.reconnectTimer = null;
  }

  async start({ onMessage }) {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    if (this.activeSocket) {
      return this.activeSocket;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: pino({ level: "silent" })
    });

    this.activeSocket = sock;
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.logger.info("whatsapp_qr_generated");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        this.isReconnecting = false;

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        this.logger.info("whatsapp_connection_opened");
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        const isActiveSocket = this.activeSocket === sock;

        if (isActiveSocket) {
          this.activeSocket = null;
        }

        this.logger.warn("whatsapp_connection_closed", {
          statusCode,
          shouldReconnect
        });

        if (shouldReconnect && !this.isReconnecting && isActiveSocket) {
          this.isReconnecting = true;
          this.reconnectTimer = setTimeout(() => {
            this.start({ onMessage })
              .catch((error) => {
                this.isReconnecting = false;
                this.logger.error("whatsapp_reconnect_failed", {
                  error: error.message,
                  stack: error.stack
                });
              })
              .finally(() => {
                this.reconnectTimer = null;
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
        await onMessage(message);
      }
    });

    return sock;
  }

  async sendText(chatId, text) {
    if (!this.activeSocket) {
      throw new Error("Socket WhatsApp belum aktif.");
    }

    await this.activeSocket.sendMessage(chatId, { text });
  }

  extractText(messageContent = {}) {
    return (
      messageContent.conversation ||
      messageContent.extendedTextMessage?.text ||
      messageContent.imageMessage?.caption ||
      messageContent.videoMessage?.caption ||
      ""
    ).trim();
  }
}

module.exports = WhatsAppGateway;
