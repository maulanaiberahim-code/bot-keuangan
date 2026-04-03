function buildHelpMessage() {
  return [
    "Daftar command yang tersedia:",
    "- help",
    "- masuk <nominal> <kategori>",
    "- keluar <nominal> <kategori>",
    "- saldo",
    "- riwayat",
    "- riwayat hari ini",
    "- riwayat bulan ini",
    "- riwayat kategori <nama-kategori>",
    "- laporan bulan ini",
    "- laporan YYYY-MM",
    "- reset",
    '- "ya reset"',
    '- "batal reset"',
    "",
    "Contoh:",
    "- masuk 50000 gaji",
    "- keluar 20000 makan",
    "- riwayat kategori makan",
    "- laporan 2026-04"
  ].join("\n");
}

module.exports = {
  buildHelpMessage
};
