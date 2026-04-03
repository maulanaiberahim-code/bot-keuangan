const request = require("supertest");
const createTestApp = require("../src/testing/createTestApp");
const WhatsAppMessageController = require("../src/adapters/whatsapp/messageController");
const AppError = require("../src/errors/AppError");
const { generateCorrelationId } = require("../src/utils/correlationId");
const { getCurrentMonthKey } = require("../src/utils/dateHelper");

const currentMonthKey = getCurrentMonthKey();

class LocalApiClient {
  constructor(app) {
    this.app = app;
  }

  async request({ method, path, body, query, correlationId, commandName }) {
    const requester = request(this.app)[method.toLowerCase()](`/api/v1${path}`)
      .set("x-api-key", "local-api-key")
      .set("x-correlation-id", correlationId)
      .set("x-command-name", commandName);

    if (query) {
      requester.query(query);
    }

    if (body) {
      requester.send(body);
    }

    const response = await requester;

    if (!response.ok || !response.body.success) {
      throw new AppError(
        response.body.error?.message || "Simulasi API gagal.",
        response.status,
        response.body.error?.code || "SIMULATION_API_FAILED",
        response.body.error?.details || {}
      );
    }

    return response.body.data;
  }
}

const testCases = [
  {
    actor: "user",
    input: "help",
    note: "Menampilkan daftar command"
  },
  {
    actor: "user",
    input: "masuk 50000 gaji",
    note: "Mencatat pemasukan valid"
  },
  {
    actor: "user",
    input: "keluar 20000 makan",
    note: "Mencatat pengeluaran valid"
  },
  {
    actor: "user",
    input: "saldo",
    note: "Menampilkan summary saldo"
  },
  {
    actor: "user",
    input: "riwayat kategori makan",
    note: "Filter riwayat berdasarkan kategori"
  },
  {
    actor: "user",
    input: "laporan bulan ini",
    note: "Laporan bulanan"
  },
  {
    actor: "user",
    input: "reset",
    note: "Request reset"
  },
  {
    actor: "user",
    input: "batal reset",
    note: "Batalkan reset"
  },
  {
    actor: "admin",
    input: "admin stats",
    note: "Admin melihat statistik global"
  },
  {
    actor: "admin",
    input: `admin stats ${currentMonthKey}`,
    note: "Admin melihat statistik global bulan tertentu"
  },
  {
    actor: "admin",
    input: "admin kategori",
    note: "Admin melihat top kategori pengeluaran"
  },
  {
    actor: "admin",
    input: `admin kategori ${currentMonthKey}`,
    note: "Admin melihat top kategori bulan tertentu"
  },
  {
    actor: "admin",
    input: "admin user aktif",
    note: "Admin melihat user paling aktif"
  },
  {
    actor: "admin",
    input: `admin user aktif ${currentMonthKey}`,
    note: "Admin melihat user paling aktif bulan tertentu"
  },
  {
    actor: "user",
    input: "masuk abc gaji",
    note: "Nominal invalid"
  },
  {
    actor: "user",
    input: "halo bot",
    note: "Command tidak dikenali"
  }
];

async function run() {
  const { app } = createTestApp({
    adminUserIds: ["628999"]
  });

  const controller = new WhatsAppMessageController({
    apiClient: new LocalApiClient(app),
    logger: createConsoleLogger()
  });

  const users = {
    user: {
      chatId: "628111@g.us",
      senderId: "628111@s.whatsapp.net",
      userId: "628111"
    },
    admin: {
      chatId: "628999@g.us",
      senderId: "628999@s.whatsapp.net",
      userId: "628999"
    }
  };

  console.log("SIMULATION TEST V4 START");
  console.log("========================");

  for (const [index, testCase] of testCases.entries()) {
    const actor = users[testCase.actor];
    const reply = await controller.handle({
      ...actor,
      correlationId: generateCorrelationId(),
      messageId: `sim-${index + 1}`,
      text: testCase.input
    });

    console.log(`[${index + 1}] ${testCase.actor.toUpperCase()} - ${testCase.note}`);
    console.log(`Input : ${JSON.stringify(testCase.input)}`);
    console.log(`Reply : ${reply === null ? "null (ignored)" : reply}`);
    console.log("---");
  }
}

function createConsoleLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {}
  };
}

run().catch((error) => {
  console.error("Simulation test failed:", error);
  process.exit(1);
});
