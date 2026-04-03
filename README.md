# Bot Keuangan V4

Bot keuangan ini sekarang sudah berevolusi dari bot WhatsApp sederhana menjadi mini backend service yang punya API layer, MongoDB repository, scheduler, observability dasar, dan adapter WhatsApp yang terpisah dari core system.

## Arsitektur

```text
WhatsApp User
    |
    v
WhatsApp Adapter (Baileys + command parser)
    |
    | HTTP + x-api-key + correlationId
    v
REST API (Express)
    |
    v
CoreFinanceService
    |
    +--> UserRepository --------> MongoDB.users
    +--> TransactionRepository -> MongoDB.transactions
    +--> DeliveryJobRepository -> MongoDB.deliveryjobs
    |
    +--> ExportService -> CSV / XLSX
    +--> Scheduler -> enqueue report jobs
    +--> Metrics -> /metrics
```

### Flow utama

```text
WhatsApp -> Adapter parse command -> API call -> Core service -> MongoDB -> API response -> Adapter format message -> WhatsApp reply
```

### Flow scheduler

```text
Cron -> ReportScheduler -> queue delivery job -> DeliveryWorker -> WhatsApp internal adapter endpoint -> user menerima laporan otomatis
```

## Struktur Folder

```text
bot-keuangan/
|-- auth/
|-- logs/
|-- scripts/
|   |-- check.js
|   |-- manual-test.js
|   `-- migrate-json-to-mongo.js
|-- src/
|   |-- adapters/
|   |   `-- whatsapp/
|   |       |-- apiClient.js
|   |       |-- commandParser.js
|   |       |-- messageController.js
|   |       |-- server.js
|   |       `-- whatsappGateway.js
|   |-- api/
|   |   |-- controllers/
|   |   |-- routes/
|   |   |-- schemas/
|   |   |-- createApp.js
|   |   `-- server.js
|   |-- app/
|   |   |-- coreFinanceService.js
|   |   `-- createAppContext.js
|   |-- config/
|   |-- db/
|   |   |-- models/
|   |   |-- repositories/
|   |   `-- connection.js
|   |-- errors/
|   |-- exports/
|   |   `-- exportService.js
|   |-- http/
|   |   |-- middlewares/
|   |   `-- response.js
|   |-- metrics/
|   |   `-- createMetricsRegistry.js
|   |-- scheduler/
|   |   |-- deliveryGateway.js
|   |   |-- deliveryWorker.js
|   |   |-- reportScheduler.js
|   |   `-- worker.js
|   |-- testing/
|   |   |-- createTestApp.js
|   |   `-- inMemoryRepositories.js
|   `-- utils/
|-- tests/
|   |-- contracts/
|   |   `-- api.contract.test.js
|   |-- integration/
|   |   `-- api.integration.test.js
|   `-- financeService.test.js
|-- .env.example
|-- package.json
`-- README.md
```

## Layer dan Tanggung Jawab

- `src/api`: HTTP entrypoint untuk client external seperti web, QA automation, mobile app, atau adapter WhatsApp.
- `src/adapters/whatsapp`: adapter channel-specific. Tugasnya hanya parse message, call API, format reply, dan mengirim balik ke WhatsApp.
- `src/app/coreFinanceService.js`: business logic inti. Semua use case utama hidup di sini.
- `src/db/repositories`: repository pattern untuk MongoDB agar core service tidak terikat ke Mongoose langsung.
- `src/testing/inMemoryRepositories.js`: repository in-memory untuk integration test tanpa Mongo live.
- `src/http/middlewares`: request context, API key auth, rate limiter, validation, centralized HTTP error handler.
- `src/scheduler`: enqueue laporan otomatis dan retry delivery job.
- `src/metrics`: Prometheus-ready metrics registry.
- `src/exports`: export CSV dan Excel.

## Data Model MongoDB

### `users`

```json
{
  "userId": "628111111111",
  "role": "user",
  "balance": 30000,
  "pendingReset": false,
  "timezone": "Asia/Jakarta",
  "preferredChannel": "whatsapp",
  "lastKnownChatId": "628111111111@s.whatsapp.net",
  "lastInteractionAt": "2026-04-04T01:00:00.000Z",
  "isActive": true
}
```

### `transactions`

```json
{
  "userId": "628111111111",
  "type": "expense",
  "amount": 20000,
  "category": "makan",
  "source": "whatsapp",
  "chatId": "628111111111@s.whatsapp.net",
  "correlationId": "4db6...",
  "idempotencyKey": "chat:message-id",
  "dateKey": "2026-04-04",
  "monthKey": "2026-04"
}
```

### `deliveryjobs`

```json
{
  "userId": "628111111111",
  "chatId": "628111111111@s.whatsapp.net",
  "channel": "whatsapp",
  "reportType": "monthly",
  "periodKey": "2026-03",
  "status": "pending",
  "attempts": 0,
  "maxAttempts": 3,
  "nextRetryAt": "2026-04-01T01:00:00.000Z"
}
```

## Endpoint API

### Core

- `POST /api/v1/transactions`
- `GET /api/v1/transactions`
- `GET /api/v1/summary`
- `GET /api/v1/reports/monthly`

### Dashboard-ready

- `GET /api/v1/reports/monthly/chart`
- `GET /api/v1/reports/monthly/categories`

### Reset

- `POST /api/v1/resets/request`
- `POST /api/v1/resets/confirm`
- `POST /api/v1/resets/cancel`

### Admin

- `GET /api/v1/admin/stats`
- `GET /api/v1/admin/categories/top`
- `GET /api/v1/admin/users/active`

### Export

- `GET /api/v1/exports/transactions.csv`
- `GET /api/v1/exports/transactions.xlsx`

### Observability / system

- `GET /health`
- `GET /metrics`

## Contoh API Request / Response

### 1. Input transaksi

```http
POST /api/v1/transactions
x-api-key: change-this-api-key
content-type: application/json

{
  "userId": "628111111111",
  "type": "income",
  "amount": 50000,
  "category": "gaji",
  "source": "api",
  "idempotencyKey": "tx-001"
}
```

```json
{
  "success": true,
  "correlationId": "a6f1c2f2-2a10-4d32-9ec8-55f0d7bba81a",
  "data": {
    "duplicate": false,
    "transaction": {
      "userId": "628111111111",
      "type": "income",
      "amount": 50000,
      "category": "gaji",
      "source": "api",
      "monthKey": "2026-04"
    },
    "balance": 50000
  }
}
```

### 2. Ambil riwayat

```http
GET /api/v1/transactions?userId=628111111111&category=makan
x-api-key: change-this-api-key
```

### 3. Laporan bulanan

```http
GET /api/v1/reports/monthly?userId=628111111111&month=2026-04
x-api-key: change-this-api-key
```

```json
{
  "success": true,
  "correlationId": "4f7f4f08-c3c8-46d3-bc0e-93f1fc4328d9",
  "data": {
    "userId": "628111111111",
    "month": "2026-04",
    "totals": {
      "income": 50000,
      "expense": 20000,
      "net": 30000,
      "transactionCount": 2
    },
    "incomeBreakdown": [
      { "category": "gaji", "amount": 50000, "count": 1 }
    ],
    "expenseBreakdown": [
      { "category": "makan", "amount": 20000, "count": 1 }
    ],
    "insights": {
      "topIncomeCategory": { "category": "gaji", "amount": 50000, "count": 1 },
      "topExpenseCategory": { "category": "makan", "amount": 20000, "count": 1 }
    }
  }
}
```

## Command WhatsApp yang Didukung

```text
help
masuk 50000 gaji
keluar 20000 makan
saldo
riwayat
riwayat hari ini
riwayat bulan ini
riwayat kategori makan
laporan bulan ini
laporan 2026-04
reset
"ya reset"
"batal reset"
admin stats
admin stats 2026-04
admin kategori
admin kategori 2026-04
admin user aktif
admin user aktif 2026-04
```

## Contoh Chat Flow

### Input transaksi

```text
User : masuk 50000 gaji
Bot  : Pemasukan berhasil dicatat.
       - Kategori: gaji
       - Nominal: Rp 50.000
       - Saldo sekarang: Rp 50.000
```

### Laporan bulanan

```text
User : laporan bulan ini
Bot  : Laporan bulan 2026-04:
       - Total pemasukan: Rp 50.000
       - Total pengeluaran: Rp 20.000
       - Selisih: Rp 30.000
       - Total transaksi: 2
```

### Multi-user isolation

```text
User A : masuk 100000 gaji
User B : saldo
Bot B  : Ringkasan saldo:
         - Saldo saat ini: Rp 0
```

### Flow internal channel

```text
WhatsApp message
-> parseCommand()
-> WhatsAppApiClient.request()
-> Express route
-> CoreFinanceService
-> Mongo repository
-> JSON response
-> messagePresenter
-> send WhatsApp reply
```

## Security

- Semua endpoint `/api/v1/*` butuh `x-api-key`.
- Endpoint internal adapter memakai `x-internal-token`.
- Rate limiting aktif via `express-rate-limit`.
- Request validation memakai `zod`.
- Admin endpoint memeriksa role user dari repository.
- Idempotency key didukung untuk mencegah duplicate transaction saat request diulang.

## Observability

### Logging

Logger memakai JSON structured logging ke console dan `logs/app.log`.

```json
{
  "level": "info",
  "message": "http_request_received",
  "timestamp": "2026-04-04T01:01:00.000Z",
  "correlationId": "7c9f57af-8d7f-4c42-a9a1-fad5600aa3de",
  "method": "POST",
  "path": "/api/v1/transactions",
  "command": "income",
  "userId": "628111111111"
}
```

### Metrics

Metrics tersedia di `/metrics` dan siap di-scrape Prometheus.

Contoh metric yang tersedia:

```text
bot_keuangan_http_requests_total{method="GET",route="/summary",status="200"} 12
bot_keuangan_http_request_duration_ms_bucket{method="POST",route="/transactions",status="201",le="100"} 8
bot_keuangan_errors_total{scope="http",code="VALIDATION_ERROR"} 3
bot_keuangan_command_usage_total{channel="whatsapp",command="income"} 6
bot_keuangan_scheduler_jobs_total{report_type="monthly",status="completed"} 4
```

## Scheduler

Yang sudah tersedia:

- laporan harian opsional
- laporan bulanan otomatis
- retry worker untuk delivery yang gagal
- delivery job deduplication per `userId + reportType + periodKey + channel`

Jalurnya:

1. `ReportScheduler` enqueue job ke MongoDB.
2. `DeliveryWorker` mengambil job due.
3. Worker memanggil endpoint internal adapter WhatsApp.
4. Jika gagal, job dijadwalkan ulang sampai `maxAttempts`.

## Setup Lokal

### Prasyarat

- Node.js 20+ dan npm
- Docker Desktop, atau MongoDB lokal yang berjalan di port `27017`
- Akun WhatsApp yang akan dipakai untuk login adapter

### 1. Masuk ke root project dan install dependency

Pastikan semua command dijalankan dari folder project, bukan dari `C:\Users\<nama-user>`.

```bash
cd C:\path\to\bot-keuangan
npm install
```

### 2. Buat file environment

```bash
copy .env.example .env
```

Nilai minimal yang perlu dicek:

- `MONGODB_URI`: URI MongoDB yang dipakai API, default lokal `mongodb://127.0.0.1:27017/bot-keuangan`
- `API_KEY`: secret sederhana yang dipakai adapter WhatsApp saat memanggil API inti
- `INTERNAL_ADAPTER_TOKEN`: secret sederhana yang dipakai scheduler saat mengirim pesan ke adapter WhatsApp
- `PORT`: port API inti, default `3000`
- `WHATSAPP_ADAPTER_PORT`: port adapter WhatsApp, default `3100`
- `ADMIN_USER_IDS`: daftar admin dipisahkan koma, gunakan `userId` numerik yang dibaca aplikasi, misalnya `628123456789`

Contoh setup lokal sederhana:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/bot-keuangan
API_KEY=local-api-key
INTERNAL_ADAPTER_TOKEN=local-adapter-token
PORT=3000
WHATSAPP_ADAPTER_PORT=3100
ADMIN_USER_IDS=
```

Catatan:

- `API_KEY` dan `INTERNAL_ADAPTER_TOKEN` tidak didapat dari layanan luar; kamu isi sendiri di `.env`
- setelah mengubah `.env`, restart proses `start:api` dan `start:bot` agar nilai baru terbaca
- untuk command admin, `ADMIN_USER_IDS` harus berisi `userId` pengirim pesan ke bot, bukan nomor bot yang login

### 3. Jalankan MongoDB

Jika memakai Docker:

```bash
docker run -d --name bot-keuangan-mongo -p 27017:27017 -v mongo-data:/data/db mongo:7
```

Jika container-nya sudah pernah dibuat, cukup start lagi:

```bash
docker start bot-keuangan-mongo
```

### 4. Jalankan API

```bash
npm run start:api
```

Jika sukses, log akan menampilkan `database_connected` lalu `api_server_started`.

### 5. Jalankan adapter WhatsApp

Buka terminal baru di folder project yang sama, lalu jalankan:

```bash
npm run start:bot
```

Jika sukses, log akan menampilkan `whatsapp_adapter_started` lalu `whatsapp_connection_opened`.

Catatan:

- saat login pertama kali, adapter akan menampilkan QR di terminal
- jika folder `auth/` sudah berisi sesi yang masih valid, QR tidak muncul dan adapter bisa langsung `open`

### 6. Jalankan scheduler worker

Scheduler tidak wajib untuk test command manual, tapi perlu jika ingin menguji laporan terjadwal.

```bash
npm run start:scheduler
```

### 7. Verifikasi cepat

Setelah API dan adapter hidup, kamu bisa coba:

```text
help
masuk 50000 gaji
keluar 20000 makan
saldo
laporan bulan ini
admin stats
```

Health check yang berguna:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3100/health
```

### Troubleshooting singkat

- `npm error enoent Could not read package.json`: kamu menjalankan command di folder yang salah; pindah dulu ke root project
- `connect ECONNREFUSED 127.0.0.1:27017`: MongoDB belum hidup atau belum expose ke port `27017`
- `Akses admin diperlukan`: cek `ADMIN_USER_IDS`, pastikan memakai `userId` numerik yang benar, lalu restart proses API
- QR tidak muncul saat `start:bot`: kemungkinan sesi lama di folder `auth/` masih valid

## Deploy ke VPS

Versi ini sudah disiapkan untuk deploy ke VPS Linux dengan Docker Compose. File yang dipakai:

- `Dockerfile`
- `docker-compose.vps.yml`
- `.env.vps.example`

Asumsi default:

- VPS sudah terpasang Docker Engine dan Docker Compose plugin
- API akan dibuka di `127.0.0.1:3000` pada VPS
- adapter WhatsApp hanya dibuka di internal Docker network
- MongoDB dijalankan sebagai container internal, bukan service terpisah di host

### 1. Copy project ke VPS

```bash
scp -r bot-keuangan user@your-vps:/opt/
ssh user@your-vps
cd /opt/bot-keuangan
```

### 2. Siapkan environment produksi

```bash
cp .env.vps.example .env.vps
```

Isi minimal yang wajib diganti:

- `API_KEY`
- `INTERNAL_ADAPTER_TOKEN`
- `ADMIN_USER_IDS`
- `TZ` jika timezone VPS kamu berbeda

Nilai berikut biasanya tidak perlu diubah jika memakai `docker-compose.vps.yml` bawaan:

- `MONGODB_URI=mongodb://mongo:27017/bot-keuangan`
- `WHATSAPP_API_BASE_URL=http://api:3000/api/v1`
- `WHATSAPP_ADAPTER_BASE_URL=http://bot:3100`

### 3. Build dan jalankan service

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

Service yang akan hidup:

- `mongo`
- `api`
- `bot`
- `scheduler`

### 4. Cek log dan health

```bash
docker compose -f docker-compose.vps.yml ps
docker compose -f docker-compose.vps.yml logs -f api
docker compose -f docker-compose.vps.yml logs -f bot
```

Jika API sehat, endpoint host akan tersedia di:

```text
http://127.0.0.1:3000/health
```

### 5. Login WhatsApp pertama kali

Saat container `bot` pertama kali hidup, QR akan muncul di log container:

```bash
docker compose -f docker-compose.vps.yml logs -f bot
```

Scan QR tersebut dari akun WhatsApp yang akan dipakai bot. Session auth akan disimpan di volume Docker `auth_data`, jadi setelah restart container biasanya tidak perlu scan ulang.

### 6. Update versi aplikasi

Setelah ada perubahan code baru:

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

Data yang tetap dipertahankan:

- database Mongo di volume `mongo_data`
- session WhatsApp di volume `auth_data`

### Catatan operasional

- log container diarahkan ke stdout/stderr Docker; file log dimatikan lewat `LOG_TO_FILE=false`
- URI Mongo yang ditulis ke log sudah disamarkan jika memakai credential
- port API di-compose dibind ke `127.0.0.1`, jadi aman untuk dipasang di balik Nginx atau Caddy
- kalau ingin membuka API ke internet, sangat disarankan lewat reverse proxy + HTTPS, bukan expose mentah dari Node

## Migrasi dari JSON ke MongoDB

Script migrasi tersedia untuk memindahkan data lama berbasis JSON:

```bash
npm run migrate:mongo
```

Catatan:

- script ini membaca `storage/transactions.json`
- script melakukan `upsert` user
- transaksi lama dipindah ke collection Mongo dengan source `json-migration`

## Testing

### Syntax check

```bash
npm run check
```

### Simulation test

```bash
npm run test:sim
```

Simulation test sekarang berjalan lewat adapter WhatsApp + REST API in-memory, jadi lebih dekat ke arsitektur V4.

### Unit + integration + contract

```bash
npm test
npm run test:integration
npm run test:contracts
```

Coverage test yang sudah ada:

- service unit test lama tetap dipertahankan
- API create transaction
- duplicate request / idempotency
- filter transaksi
- laporan bulanan
- admin authorization
- invalid payload
- response contract summary
- response contract monthly report

## Design Decision

- Core business logic ditempatkan di `CoreFinanceService` agar WhatsApp, web, dan API memakai use case yang sama.
- Repository pattern dipertahankan saat migrasi ke MongoDB supaya controller tidak menyentuh Mongoose langsung.
- WhatsApp diperlakukan sebagai adapter, bukan sumber business logic.
- API dibuat konsisten dengan envelope `success/correlationId/data`.
- Metrics disiapkan sejak awal agar transisi ke Prometheus/Grafana tidak perlu refactor besar.
- In-memory repositories dipertahankan untuk integration test agar QA bisa tes cepat tanpa dependency database live.
- Scheduler memakai delivery job collection sederhana, bukan queue system besar, supaya tetap clean dan tidak over-engineered.

## Risiko dan Edge Case

- Amount saat ini diasumsikan rupiah integer. Input seperti `0.5` atau `1.250,50` akan dianggap invalid.
- Command WhatsApp tetap berbasis regex sederhana, jadi typo user masih bisa jatuh ke unknown command.
- Adapter WhatsApp dan API berjalan di proses terpisah; kalau base URL atau token internal salah, delivery scheduler akan gagal kirim.
- Scheduler belum memakai distributed lock. Untuk production multi-instance, worker perlu strategi leader election atau queue terpusat.
- Export saat ini menulis file ke folder lokal `exports/`, jadi deployment stateless butuh object storage jika ingin lebih production-ready.
- Integration test belum menjalankan Mongo sungguhan. Untuk hardening lebih lanjut, bisa ditambah test berbasis test container Mongo.

## Next Step yang Paling Masuk Akal

- tambah OpenAPI spec / Swagger
- tambah test Mongo integration sungguhan
- tambahkan dashboard frontend
- tambahkan queue broker jika worker sudah multi-instance
- tambahkan audit log dan backup strategy
