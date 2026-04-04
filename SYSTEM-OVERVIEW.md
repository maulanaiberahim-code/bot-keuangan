# System Overview

Dokumen ini adalah ringkasan sistem untuk memahami apa yang sudah dibangun, bagaimana komponennya bekerja, dan status proyek saat ini. Fokusnya bukan panduan setup teknis, tetapi gambaran besar yang lebih cocok untuk onboarding, review progres, atau presentasi singkat.

## 1. Ringkasan Singkat

Bot Keuangan adalah sistem pencatatan keuangan pribadi berbasis WhatsApp yang sudah berkembang menjadi mini backend service. Aplikasi ini tidak lagi hanya berupa bot yang memproses pesan secara langsung, tetapi terdiri dari beberapa komponen yang dipisah dengan tanggung jawab yang jelas:

- adapter WhatsApp untuk menerima dan mengirim pesan
- REST API sebagai pintu masuk business logic
- MongoDB untuk penyimpanan data
- scheduler untuk laporan otomatis dan retry job

Dengan bentuk seperti ini, channel WhatsApp menjadi salah satu adapter, sedangkan business logic inti tetap berada di layer service. Ini membuat sistem lebih mudah diuji, dipelihara, dan dikembangkan ke channel lain di masa depan.

## 2. Tujuan Sistem

Sistem ini dirancang untuk membantu user mencatat pemasukan dan pengeluaran langsung dari WhatsApp dengan command sederhana. Selain pencatatan transaksi dasar, sistem juga mendukung:

- ringkasan saldo
- riwayat transaksi
- laporan bulanan
- command admin untuk melihat statistik global
- export data
- pengiriman laporan terjadwal

Target akhirnya adalah bot yang cukup ringan untuk dipakai personal atau small-scale production, tetapi strukturnya sudah cukup rapi untuk dijalankan di VPS.

## 3. Arsitektur Tingkat Tinggi

Sistem berjalan dalam empat komponen utama:

1. `bot`
   Adapter WhatsApp berbasis Baileys. Tugasnya membaca pesan masuk, parse command, memanggil API inti, memformat hasil, dan mengirim balasan.

2. `api`
   REST API berbasis Express. Semua request dari adapter atau client lain masuk ke sini. API melakukan validasi, auth, routing, dan memanggil service inti.

3. `scheduler`
   Worker terpisah untuk enqueue laporan otomatis dan menjalankan retry pengiriman pesan jika ada job yang gagal.

4. `mongo`
   Database MongoDB untuk user, transaksi, dan delivery job.

Secara konsep, alurnya seperti ini:

```text
WhatsApp User
  -> WhatsApp Adapter
  -> REST API
  -> CoreFinanceService
  -> MongoDB
  -> REST API response
  -> WhatsApp Adapter
  -> WhatsApp reply
```

Untuk laporan otomatis:

```text
Scheduler cron
  -> ReportScheduler
  -> delivery job
  -> DeliveryWorker
  -> internal adapter endpoint
  -> WhatsApp user menerima laporan
```

## 4. Fitur yang Sudah Tersedia

### Fitur user

- `help`
- `masuk <nominal> <kategori>`
- `keluar <nominal> <kategori>`
- `saldo`
- `riwayat`
- `riwayat hari ini`
- `riwayat bulan ini`
- `riwayat kategori <nama-kategori>`
- `laporan bulan ini`
- `laporan YYYY-MM`
- `reset`
- `ya reset`
- `batal reset`

### Fitur admin

- `admin stats`
- `admin kategori`
- `admin user aktif`
- `admin stats YYYY-MM`
- `admin kategori YYYY-MM`
- `admin user aktif YYYY-MM`

### Fitur sistem

- API key auth untuk akses API utama
- internal token auth untuk pengiriman dari scheduler ke adapter
- MongoDB repository pattern
- export transaksi ke CSV dan XLSX
- health endpoint
- metrics endpoint
- scheduler laporan dan retry delivery
- restart policy berbasis Docker Compose

## 5. Cara Kerja Per Komponen

### WhatsApp adapter

Adapter menerima event pesan dari WhatsApp, lalu:

1. mengekstrak `chatId`, `senderId`, dan `userId`
2. melakukan parsing command
3. memanggil API internal
4. menerima response dari API
5. memformat pesan balasan
6. mengirim pesan kembali ke WhatsApp

Adapter juga menyimpan session auth WhatsApp ke storage lokal agar login tidak perlu diulang setiap restart biasa.

### API

API bertugas:

- validasi request body dan query
- verifikasi `x-api-key`
- membuat request context dan correlation id
- memanggil `CoreFinanceService`
- mengembalikan response dalam format envelope yang konsisten

Business logic utama sengaja tidak diletakkan di adapter maupun controller, tetapi di service inti.

### Core service

`CoreFinanceService` adalah pusat dari sistem. Di sinilah logika seperti berikut dijalankan:

- tambah transaksi income/expense
- hitung saldo
- ambil riwayat
- bangun laporan bulanan
- reset data user
- verifikasi akses admin
- kumpulkan global stats
- queue laporan terjadwal

### MongoDB

MongoDB menyimpan:

- `users`
- `transactions`
- `deliveryjobs`

Repository Mongo dipisahkan dari service supaya perubahan storage tidak langsung merusak business logic.

### Scheduler

Scheduler berjalan terpisah dari API dan bot. Tugasnya:

- membuat job laporan harian/bulanan
- retry pengiriman yang sebelumnya gagal
- berkomunikasi ke adapter WhatsApp lewat internal endpoint

Dengan pemisahan ini, flow pesan biasa dan flow laporan otomatis tidak saling mengganggu.

## 6. Data yang Disimpan

Secara garis besar:

- `users` menyimpan role, saldo, status reset, channel terakhir, dan waktu interaksi
- `transactions` menyimpan nominal, kategori, tipe transaksi, month key, date key, dan metadata asal request
- `deliveryjobs` menyimpan job laporan terjadwal, status, jumlah percobaan, dan retry time

Ini membuat sistem bisa melakukan:

- perhitungan saldo real-time
- filter transaksi per hari/bulan/kategori
- laporan bulanan
- statistik admin
- retry pengiriman pesan otomatis

## 7. Pengamanan Dasar

Beberapa guardrail yang sudah ada:

- API utama dilindungi `x-api-key`
- internal adapter endpoint dilindungi `x-internal-token`
- validasi input memakai schema
- admin access diverifikasi berdasarkan `ADMIN_USER_IDS`
- `userId` dinormalisasi agar konsisten
- URI Mongo yang ditulis ke log disamarkan jika mengandung credential

Ini belum setingkat sistem enterprise, tapi sudah cukup baik untuk small production workload di VPS.

## 8. Pengujian

Sistem sudah memiliki automated test yang mencakup:

- finance service test
- API integration test
- API contract test
- WhatsApp command parser test

Test memastikan beberapa area penting tetap aman:

- create transaction
- duplicate / idempotency
- filter transaksi
- monthly report
- admin authorization
- invalid payload
- response contract
- parsing command admin dan validasi month key

Selain test otomatis, tersedia juga simulation test untuk menguji flow adapter WhatsApp tanpa perlu chat sungguhan.

## 9. Status Deploy dan VPS

Sistem sudah disiapkan untuk dijalankan di VPS menggunakan Docker Compose.

Artefak deploy yang sudah tersedia:

- `Dockerfile`
- `docker-compose.vps.yml`
- `.env.vps.example`
- `VPS-OPERATIONS.md`

Dalam mode VPS:

- Node.js tetap dipakai sebagai runtime aplikasi
- Docker hanya menjadi cara packaging dan process management
- service dipisah ke container `api`, `bot`, `scheduler`, dan `mongo`
- session WhatsApp disimpan di volume agar tidak hilang saat restart biasa
- database Mongo disimpan di volume terpisah

Artinya sistem ini sekarang sudah tidak hanya cocok untuk local development, tetapi juga sudah layak dijalankan di server.

## 10. Apa yang Sudah Berhasil Diselesaikan

Milestone penting yang sudah tercapai:

- migrasi pola bot sederhana ke arsitektur service-oriented kecil
- MongoDB repository integration
- REST API layer yang rapi
- adapter WhatsApp terpisah dari business logic
- scheduler dan retry worker
- admin command
- export data
- test suite stabil
- dokumentasi setup lokal
- dokumentasi deploy VPS
- panduan operasional VPS

Secara praktis, ini berarti sistem sudah berada di tahap yang cukup matang untuk dipakai dan dikembangkan lanjut, bukan lagi prototype mentah.

## 11. Batasan yang Masih Ada

Walau sudah cukup solid, masih ada beberapa batasan yang perlu disadari:

- bot health check saat ini lebih dekat ke health HTTP adapter, belum health koneksi WhatsApp yang benar-benar mendalam
- jika akun WhatsApp logout, tetap bisa perlu scan ulang QR
- scheduler belum didesain untuk multi-instance dengan distributed lock
- export masih menulis file ke filesystem lokal container/host
- belum ada reverse proxy HTTPS bawaan dalam stack deploy
- backup database dan auth volume masih perlu dioperasikan secara sadar

Jadi sistem ini sudah cukup siap untuk VPS tunggal, tetapi belum ditujukan untuk skenario high-scale atau multi-node.

## 12. Arah Pengembangan Berikutnya

Langkah berikut yang paling masuk akal biasanya salah satu dari:

- hardening monitoring dan health check
- reverse proxy + HTTPS
- backup automation
- command laporan tambahan seperti `bulan lalu`
- dashboard web atau admin panel
- notifikasi dan observability yang lebih lengkap

## 13. Kesimpulan

Bot Keuangan saat ini adalah sistem backend WhatsApp yang sudah memiliki pemisahan komponen yang jelas, database persistence, API layer, scheduler, fitur admin, export, automated test, dan jalur deploy VPS yang cukup rapi. Untuk skala kecil sampai menengah di satu VPS, sistem ini sudah berada di kondisi usable dan maintainable.

Dengan kata lain, proyek ini sekarang sudah bergerak dari sekadar bot chat menjadi aplikasi layanan yang punya struktur software engineering yang lebih serius.
