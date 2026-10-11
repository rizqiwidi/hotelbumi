# Bumi Surabaya — Digital Guest Experience v5.0

Platform pelacakan tamu dan atribusi staf berbasis **NFC / QR Code** untuk Hotel Bumi Surabaya City Resort.

---

## Gambaran Singkat

| Komponen | Teknologi | Keterangan |
|---|---|---|
| **Guest View** | HTML + CSS + Vanilla JS | Ultra-ringan (<40 KB), tanpa framework |
| **Admin Portal** | HTML + Chart.js + QRCode.js | Terisolasi di `/admin/`, terproteksi token |
| **Backend API** | Google Apps Script | Serverless, gratis, terintegrasi Google Sheets |
| **Database** | Google Sheets | 6 tab terstruktur, partisi bulanan otomatis |
| **Hosting** | Cloudflare Pages | CDN global, HTTPS otomatis, deploy via Git |

---

## Cara Kerja

1. **Staf hotel** membawa kartu fisik NFC yang sudah diprogram dengan URL unik:  
   `https://guest.bumisurabaya.com/?source=staff-budi-santoso`

2. **Tamu** tap kartu → browser otomatis membuka halaman dengan sapaan personal staf.

3. **Sistem** mencatat event kunjungan, klik review, dan durasi kunjungan ke Google Sheets.

4. **Admin** membuka `/admin/` untuk melihat leaderboard, audit kecurangan, dan laporan performa.

---

## Struktur Direktori

```
app/
├── index.html              # Halaman tamu (publik, <40 KB total)
├── admin/
│   └── index.html          # Portal admin (hanya admin berwenang)
├── assets/
│   ├── css/
│   │   ├── guest.css       # Styling elegan tema hotel untuk tamu
│   │   ├── admin.css       # Styling dashboard admin
│   │   └── print.css       # Styling cetak kartu meja / QR sticker
│   ├── js/
│   │   ├── config.js       # Konstanta & fallback defaults
│   │   ├── guest/          # Modul khusus tamu (app, tracking, fingerprint, retry-queue)
│   │   └── admin/          # Modul khusus admin (auth, api, dashboard, staff-manager, anti-fraud, web-nfc)
│   └── images/
│       └── logo-gold.svg   # Logo vektor resmi hotel
├── backend/
│   ├── Code.gs             # Kode utama Google Apps Script (doPost, doGet)
│   ├── Triggers.gs         # Cron job email mingguan & agregasi bulanan
│   └── appsscript.json     # Manifest runtime Apps Script
└── docs/
    ├── SHEETS_SETUP.md     # Panduan setup Google Sheets sebagai database
    ├── DEPLOY.md           # Panduan deploy ke Cloudflare Pages
    └── ASSUMPTIONS.md      # Catatan asumsi implementasi
```

---

## Setup Cepat (Quick Start)

### Prasyarat
- Akun Google (untuk Apps Script + Sheets)
- Akun Cloudflare (gratis)
- Repositori Git (GitHub / GitLab)

### Langkah 1 — Setup Database Google Sheets

Ikuti panduan lengkap di **[docs/SHEETS_SETUP.md](./docs/SHEETS_SETUP.md)**:

1. Buat Google Spreadsheet baru
2. Buat 6 tab: `Config`, `Sources`, `StaffDevices`, `MonthlyAggregates`, `ScriptLog` + tab Events otomatis
3. Pasang kode `backend/Code.gs` dan `backend/Triggers.gs` di Apps Script
4. Atur Script Properties: `READ_TOKEN` dan `EMAIL_MANAJEMEN`
5. Deploy sebagai Web App → salin URL endpoint

### Langkah 2 — Deploy ke Cloudflare Pages

Ikuti panduan di **[docs/DEPLOY.md](./docs/DEPLOY.md)**:

1. Push repositori ke GitHub / GitLab
2. Buat project di Cloudflare Pages → Build output: `app`
3. Opsional: konfigurasikan domain kustom `guest.bumisurabaya.com`

### Langkah 3 — Konfigurasi Admin Pertama Kali

1. Buka `https://[domain]/admin/`
2. Masukkan URL GAS Backend + READ_TOKEN
3. Login → tambah staf pertama → Simpan & Sinkronkan ke Cloud
4. Uji tap kartu: `/?source=[kode-staf]` → sapaan personal harus muncul

---

## Fitur Utama

### Guest View (`/`)
- ✅ Sapaan personal otomatis berdasarkan `?source=` parameter
- ✅ Tombol Google Review & WhatsApp reservasi terpusat
- ✅ Galeri promosi F&B (Pasar Malam, Omakase, High Tea)
- ✅ Tracking kunjungan tanpa PII (Zero-PII)
- ✅ Retry queue offline (exponential backoff)
- ✅ Beacon dwell time untuk deteksi kunjungan hampa

### Admin Portal (`/admin/`)
- ✅ Login terproteksi dengan brute-force lockout (5 percobaan / 15 menit)
- ✅ Token API dikirim via POST body (bukan URL parameter)
- ✅ Dashboard dengan 5 metrik utama + grafik tren harian
- ✅ Leaderboard staf & gerai berdasarkan Skor Kualitas Anti-Fraud
- ✅ Manajemen CRUD staf: tambah, edit, rotasi kode, nonaktifkan
- ✅ Programmer Web NFC 1-klik (Android Chrome) + panduan NFC Tools (iOS)
- ✅ Generator QR code + preview cetak kartu meja
- ✅ Tab Audit Anti-Fraud dengan tabel event mencurigakan
- ✅ Ekspor laporan CSV siap Excel

### Backend Anti-Fraud (8 Aturan)

| Kode | Aturan | Sanksi |
|---|---|---|
| AF-01 | Velocity Limit (>3 kunjungan/24 jam dari 1 perangkat ke 1 staf) | Skor = 0 |
| AF-02 | Burst Detection (≥5 kunjungan dalam 10 menit) | Skor = 0 |
| AF-03 | Self-Tap HP Staf (device_id cocok StaffDevices) | Skor = 0 |
| AF-04 | Low-Quality Dwell (<5 detik + 0 interaksi) | Skor = 0 |
| AF-05 | Source Hopping (≥4 sumber berbeda dalam 1 jam) | Skor = 0 |
| AF-06 | Bot Honeypot (field tersembunyi terisi) | Blokir + Skor = 0 |
| AF-07 | Shared IP Flood (≥5 device dari 1 IP ke 1 sumber / 10 menit) | Flag untuk review |
| AF-08 | Odd Hour (00:00–05:30 WIB) | Flag untuk audit |

---

## Keamanan

- **Isolasi sempurna**: Guest View tidak mengandung satu pun kode admin
- **Zero-PII**: Tidak ada nama tamu, email, atau nomor telepon yang disimpan
- **IP tersamar**: Dua oktet terakhir disembunyikan di dashboard (`114.125.x.x`)
- **Token via body**: READ_TOKEN tidak pernah muncul di URL / query string
- **Brute-force protection**: Lockout 15 menit setelah 5 login gagal

---

## Pemeliharaan

| Tindakan | Kapan |
|---|---|
| Review laporan mingguan | Setiap Senin (email otomatis) |
| Arsipkan tab Events lama | Tiap 6–12 bulan (jika spreadsheet melambat) |
| Rotasi READ_TOKEN | Jika ada pergantian staf IT |
| Update data staf | Saat ada mutasi/resign staf hotel |

---

## Referensi

- [PRD v5.0](./prd/PRD_Bumi_Surabaya_v5.md) — Spesifikasi produk lengkap
- [SHEETS_SETUP.md](./docs/SHEETS_SETUP.md) — Panduan database
- [DEPLOY.md](./docs/DEPLOY.md) — Panduan deployment
- [ASSUMPTIONS.md](./docs/ASSUMPTIONS.md) — Catatan asumsi implementasi

---

*Platform ini dirancang khusus untuk **Hotel Bumi Surabaya City Resort**.*  
*Hak Cipta © 2026 Bumi Surabaya City Resort. Semua hak dilindungi.*
