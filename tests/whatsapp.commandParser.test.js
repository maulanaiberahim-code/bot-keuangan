const { parseCommand } = require("../src/adapters/whatsapp/commandParser");

describe("WhatsApp command parser", () => {
  test("mendukung pemasukan dengan tanggal transaksi lampau", () => {
    expect(parseCommand("masuk 50000 gaji tanggal 2026-04-05")).toEqual({
      name: "income",
      amount: "50000",
      category: "gaji",
      transactionDate: "2026-04-05"
    });
  });

  test("command transaksi biasa tetap tanpa tanggal transaksi", () => {
    expect(parseCommand("keluar 20000 makan")).toEqual({
      name: "expense",
      amount: "20000",
      category: "makan",
      transactionDate: null
    });
  });

  test("mendukung riwayat rentang tanggal", () => {
    expect(parseCommand("riwayat 2026-04-01 sampai 2026-04-05")).toEqual({
      name: "history",
      filter: {
        fromDateKey: "2026-04-01",
        toDateKey: "2026-04-05"
      }
    });
  });

  test("mendukung riwayat detail transaksi", () => {
    expect(parseCommand("riwayat detail abc123")).toEqual({
      name: "transaction_detail",
      transactionId: "abc123"
    });
  });

  test("mendukung ubah transaksi", () => {
    expect(parseCommand("ubah abc123 keluar 25000 makan tanggal 2026-04-05")).toEqual({
      name: "update_transaction",
      transactionId: "abc123",
      type: "expense",
      amount: "25000",
      category: "makan",
      transactionDate: "2026-04-05"
    });
  });

  test("mendukung hapus transaksi", () => {
    expect(parseCommand("hapus abc123")).toEqual({
      name: "delete_transaction",
      transactionId: "abc123"
    });
  });

  test("mendukung konfirmasi hapus transaksi", () => {
    expect(parseCommand("konfirmasi hapus abc123")).toEqual({
      name: "confirm_delete_transaction",
      transactionId: "abc123"
    });
  });

  test("menolak riwayat rentang tanggal yang tidak valid", () => {
    expect(parseCommand("riwayat 2026-04-31 sampai 2026-05-01")).toEqual({
      name: "unknown"
    });
  });

  test("mendukung admin stats untuk bulan tertentu", () => {
    expect(parseCommand("admin stats 2026-04")).toEqual({
      name: "admin_stats",
      month: "2026-04"
    });
  });

  test("mendukung admin kategori untuk bulan tertentu", () => {
    expect(parseCommand("admin kategori 2026-04")).toEqual({
      name: "admin_top_categories",
      month: "2026-04"
    });
  });

  test("mendukung admin user aktif untuk bulan tertentu", () => {
    expect(parseCommand("admin user aktif 2026-04")).toEqual({
      name: "admin_active_users",
      month: "2026-04"
    });
  });

  test("menolak laporan dengan month tidak valid", () => {
    expect(parseCommand("laporan 2026-13")).toEqual({
      name: "unknown"
    });
  });

  test("menolak command admin dengan month tidak valid", () => {
    expect(parseCommand("admin stats 2026-13")).toEqual({
      name: "unknown"
    });
  });
});
