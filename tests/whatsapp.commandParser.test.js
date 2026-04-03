const { parseCommand } = require("../src/adapters/whatsapp/commandParser");

describe("WhatsApp command parser", () => {
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
