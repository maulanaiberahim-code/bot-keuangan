const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const AppError = require("../errors/AppError");
const { EXPORT_DIR } = require("../config/paths");

class ExportService {
  constructor({ transactionRepository }) {
    this.transactionRepository = transactionRepository;
  }

  async buildCsvExport(transactions, fileName) {
    this.ensureExportDir();

    const headers = ["transactionAt", "createdAt", "userId", "type", "amount", "category", "source", "chatId"];
    const lines = [
      headers.join(","),
      ...transactions.map((transaction) => headers
        .map((key) => this.escapeCsvValue(transaction[key] ?? ""))
        .join(","))
    ];

    const filePath = this.resolveExportPath(fileName);
    fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");

    return {
      contentType: "text/csv",
      filePath,
      fileName,
      size: Buffer.byteLength(lines.join("\n"), "utf8")
    };
  }

  async buildExcelExport(transactions, fileName) {
    this.ensureExportDir();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transactions");

    sheet.columns = [
      { header: "Tanggal Transaksi", key: "transactionAt", width: 24 },
      { header: "Tanggal", key: "createdAt", width: 24 },
      { header: "User ID", key: "userId", width: 18 },
      { header: "Tipe", key: "type", width: 12 },
      { header: "Nominal", key: "amount", width: 18 },
      { header: "Kategori", key: "category", width: 18 },
      { header: "Source", key: "source", width: 12 },
      { header: "Chat ID", key: "chatId", width: 24 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE9F2FF" }
    };

    transactions.forEach((transaction) => {
      sheet.addRow({
        transactionAt: transaction.transactionAt,
        createdAt: transaction.createdAt,
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        category: transaction.category,
        source: transaction.source,
        chatId: transaction.chatId
      });
    });

    sheet.getColumn("amount").numFmt = "#,##0";
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const filePath = this.resolveExportPath(fileName);
    await workbook.xlsx.writeFile(filePath);
    const stats = fs.statSync(filePath);

    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filePath,
      fileName,
      size: stats.size
    };
  }

  ensureExportDir() {
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
  }

  resolveExportPath(fileName) {
    const exportRoot = path.resolve(EXPORT_DIR);
    const filePath = path.resolve(exportRoot, fileName);

    if (filePath !== exportRoot && !filePath.startsWith(`${exportRoot}${path.sep}`)) {
      throw new AppError("Nama file export tidak valid.", 400, "INVALID_EXPORT_FILENAME");
    }

    return filePath;
  }

  escapeCsvValue(value) {
    const normalized = String(value);

    if (normalized.includes(",") || normalized.includes("\"") || normalized.includes("\n")) {
      return `"${normalized.replace(/"/g, "\"\"")}"`;
    }

    return normalized;
  }
}

module.exports = ExportService;
