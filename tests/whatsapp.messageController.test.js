const WhatsAppMessageController = require("../src/adapters/whatsapp/messageController");

describe("WhatsApp message controller", () => {
  function createController(overrides = {}) {
    const apiClient = {
      request: jest.fn().mockResolvedValue({
        duplicate: false,
        balance: 30000,
        transaction: {
          type: "expense",
          amount: 20000,
          category: "makan",
          transactionAt: "2026-04-05T05:00:00.000Z"
        }
      })
    };
    const logger = {
      info: jest.fn(),
      error: jest.fn()
    };

    return {
      apiClient,
      logger,
      controller: new WhatsAppMessageController({
        apiClient,
        logger,
        adminUserIds: ["628999"],
        ...overrides
      })
    };
  }

  test("help user biasa tidak menampilkan command admin", async () => {
    const { controller } = createController();

    const response = await controller.handle({
      text: "help",
      userId: "628111",
      chatId: "chat-1",
      correlationId: "corr-1"
    });

    expect(response).toContain("- masuk 50000 gaji tanggal 2026-04-05");
    expect(response).toContain("- riwayat detail <id>");
    expect(response).toContain("- riwayat 2026-04-01 sampai 2026-04-05");
    expect(response).toContain("- ubah <id> keluar 25000 makan tanggal 2026-04-05");
    expect(response).toContain("- hapus <id>");
    expect(response).toContain("- konfirmasi hapus <id>");
    expect(response).not.toContain("admin stats");
  });

  test("help admin menampilkan command admin", async () => {
    const { controller } = createController();

    const response = await controller.handle({
      text: "help",
      userId: "628999",
      chatId: "chat-1",
      correlationId: "corr-1"
    });

    expect(response).toContain("Menu admin");
    expect(response).toContain("admin stats");
  });

  test("transaksi WhatsApp meneruskan tanggal transaksi ke API", async () => {
    const { apiClient, controller } = createController();

    await controller.handle({
      text: "keluar 20000 makan tanggal 2026-04-05",
      userId: "628111",
      chatId: "chat-1",
      correlationId: "corr-1",
      messageId: "msg-1"
    });

    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/transactions",
      body: expect.objectContaining({
        type: "expense",
        amount: "20000",
        category: "makan",
        transactionDate: "2026-04-05"
      })
    }));
  });

  test("riwayat rentang tanggal diteruskan ke API", async () => {
    const { apiClient, controller } = createController();
    apiClient.request.mockResolvedValueOnce([]);

    await controller.handle({
      text: "riwayat 2026-04-01 sampai 2026-04-05",
      userId: "628111",
      chatId: "chat-1",
      correlationId: "corr-2"
    });

    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/transactions",
      query: expect.objectContaining({
        userId: "628111",
        fromDateKey: "2026-04-01",
        toDateKey: "2026-04-05",
        limit: 10
      })
    }));
  });

  test("riwayat detail diteruskan ke API", async () => {
    const { apiClient, controller } = createController();

    await controller.handle({
      text: "riwayat detail trx-1",
      userId: "628111",
      chatId: "chat-1",
      correlationId: "corr-2a"
    });

    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/transactions/trx-1",
      query: expect.objectContaining({
        userId: "628111",
        chatId: "chat-1"
      })
    }));
  });

  test("ubah transaksi diteruskan ke API", async () => {
    const { apiClient, controller } = createController();

    await controller.handle({
      text: "ubah trx-1 keluar 25000 makan tanggal 2026-04-05",
      userId: "628111",
      chatId: "chat-1",
      correlationId: "corr-3"
    });

    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "PATCH",
      path: "/transactions/trx-1",
      body: expect.objectContaining({
        userId: "628111",
        type: "expense",
        amount: "25000",
        category: "makan",
        transactionDate: "2026-04-05"
      })
    }));
  });

  test("hapus transaksi diteruskan ke API", async () => {
    const { apiClient, controller } = createController();

    await controller.handle({
      text: "hapus trx-1",
      userId: "628111",
      chatId: "chat-1",
      correlationId: "corr-4"
    });

    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/transactions/trx-1/delete-request",
      body: expect.objectContaining({
        userId: "628111",
        chatId: "chat-1"
      })
    }));
  });

  test("konfirmasi hapus transaksi diteruskan ke API", async () => {
    const { apiClient, controller } = createController();
    apiClient.request.mockResolvedValueOnce({
      status: "completed",
      balance: 10000,
      transaction: {
        _id: "trx-1",
        type: "expense",
        amount: 20000,
        category: "makan"
      }
    });

    await controller.handle({
      text: "konfirmasi hapus trx-1",
      userId: "628111",
      chatId: "chat-1",
      correlationId: "corr-5"
    });

    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/transactions/trx-1/delete-confirm",
      body: expect.objectContaining({
        userId: "628111",
        chatId: "chat-1"
      })
    }));
  });
});
