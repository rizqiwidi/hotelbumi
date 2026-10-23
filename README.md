# Bumi Surabaya — Digital Guest Experience v6.8

Platform pelacakan tamu dan atribusi staf berbasis **NFC / QR Code** untuk Hotel Bumi Surabaya City Resort.

---

## Gambaran Singkat

| Komponen | Teknologi | Keterangan |
|---|---|---|
| **Guest View** | HTML + CSS + Vanilla JS | Ultra-ringan (<40 KB), tanpa framework, aman XSS |
| **Admin Portal** | HTML + Chart.js + QRCode.js | Terisolasi di `/admin/`, terproteksi sesi kriptografis 6 jam |
| **Backend API** | Google Apps Script | Serverless, terintegrasi Google Sheets, key stretching iterative SHA-256 |
| **Database** | Google Sheets | Tab terstruktur: `Config`, `Sources`, `Users`, `StaffDevices`, partisi bulanan `Events_YYYY_MM` |
| **Hosting** | GitHub Pages | Di-deploy dari branch `main` pada root repository: `https://rizqiwidi.github.io/hotelbumi/` |

---

## Cara Kerja

1. **Staf hotel** membawa kartu fisik NFC / QR Code yang diprogram dengan URL unik:  
   `https://rizqiwidi.github.io/hotelbumi/?source=staff-budi-santoso`

2. **Tamu** tap kartu / scan QR → browser membuka halaman dengan sapaan personal staf, penawaran promosi gerai, dan opsi ulasan/reservasi.

3. **Sistem** mencatat event kunjungan, klik review, dan dwell time ke Google Sheets dengan timestamp server dan idempotensi `event_id`.

4. **Admin** membuka `/admin/` untuk memantau metrik performa, audit anomali anti-fraud, dan mengelola perangkat staf.

---

## Struktur Direktori Repository

```
hotelbumi/
├── index.html              # Halaman tamu publik (GitHub Pages root)
├── manifest.json           # Manifest PWA (ikon, warna tema, mode standalone)
├── sw.js                   # Service worker: cache aset statis halaman tamu
├── admin/
│   └── index.html          # Portal manajemen administrator (/admin/)
├── assets/
│   ├── css/
│   │   ├── guest.css       # Desain tema hotel tamu (Deep Emerald, Champagne Gold, dll.)
│   │   ├── admin.css       # Desain portal admin
│   │   └── print.css       # Desain cetak stiker meja & kartu QR
│   ├── js/
│   │   ├── config.js       # Konfigurasi publik allowlist & fallback
│   │   ├── guest/
│   │   │   ├── app.js          # Logika presentasi tamu (aman XSS via DOM API)
│   │   │   ├── tracking.js     # Tracker interaksi & sendBeacon dwell
│   │   │   ├── fingerprint.js  # Generator pengenal pseudonim perangkat (device_id)
│   │   │   └── retry-queue.js  # Antrean offline, backoff eksponensial & Dead-Letter Queue
│   │   └── admin/
│   │       ├── auth.js         # Pengelola login & sesi token kriptografis (TTL 6 jam)
│   │       ├── api.js          # API client admin terproteksi token sesi
│   │       ├── dashboard.js    # Visualisasi data & metrik leaderboard
│   │       ├── staff-manager.js# Manajemen data staf & titik NFC
│   │       ├── anti-fraud.js   # Spesifikasi terpadu 8 aturan anti-fraud (AF-01 s/d AF-08)
│   │       └── web-nfc.js      # Pemrograman kartu Web NFC
│   └── images/             # Aset gambar gerai & logo hotel
├── backend/
│   ├── Code.gs             # Handler API doPost/doGet, sesi, hashing, allowlist config
│   ├── Triggers.gs         # Laporan email otomatis & rekapitulasi integritas data
│   └── appsscript.json     # Manifest konfigurasi Google Apps Script
├── PRD.md               # Dokumen tunggal spesifikasi produk & status eksekusi
└── docs/
    ├── SHEETS_SETUP.md     # Panduan setup Google Sheets & pembuatan akun admin
    ├── DEPLOY.md           # Panduan deployment GitHub Pages & Google Apps Script
    └── ASSUMPTIONS.md      # Catatan asumsi teknis & batasan platform
```

---

## Setup Cepat (Quick Start)

### Prasyarat
- Akun Google (untuk Google Sheets & Google Apps Script)
- Repository GitHub: `https://github.com/rizqiwidi/hotelbumi`

### Langkah 1 — Setup Database Google Sheets
Ikuti panduan lengkap di **[docs/SHEETS_SETUP.md](./docs/SHEETS_SETUP.md)**:
1. Buat Google Spreadsheet baru.
2. Buat tab: `Config`, `Sources`, `StaffDevices`, `MonthlyAggregates`, `ScriptLog`.
3. Pasang `backend/Code.gs` dan `backend/Triggers.gs` di Apps Script editor.
4. Jalankan fungsi `setupInitialAdmin('admin', 'PasswordAnda2026!')` untuk inisialisasi akun administrator awal.
5. Deploy sebagai Web App (Akses: *Anyone*) → salin URL Web App (`/exec`).

### Langkah 2 — Deploy ke GitHub Pages
Ikuti panduan di **[docs/DEPLOY.md](./docs/DEPLOY.md)**:
1. Di GitHub repository: buka **Settings** → **Pages**.
2. Pilih branch `main` dan folder `/ (root)`.
3. Simpan dan tunggu proses deploy selesai.

### Langkah 3 — Konfigurasi Admin Pertama Kali
1. Buka `https://rizqiwidi.github.io/hotelbumi/admin/`.
2. Masuk menggunakan akun admin yang telah dibuat.
3. Di menu **Konfigurasi**, simpan URL Web App Apps Script Anda.
4. Daftarkan staf hotel dan gerai via menu **Manajemen Staf & Titik NFC**.
5. Daftarkan HP staf di tab **Audit Anti-Fraud** untuk pengecualian self-tap (AF-03).

---

## Fitur Utama

### Guest View (`/`)
- ✅ **Resolusi Atribusi Bertingkat**: URL parameter `?source=` diprioritaskan, diikuti sesi aktif (TTL 30 menit), dan fallback default aman (GUE-05, GUE-12).
- ✅ **Sapaan Personal & Gerai Terkurasi**: Sapaan staf/meja personal aman XSS via DOM API, hanya menampilkan gerai dengan status aktif (GUE-04, GUE-07).
- ✅ **Validasi Kontak & CTA**: Pembersihan nomor WhatsApp ke format internasional (`628...`) dan validasi skema URL reservasi. Gerai tanpa kontak valid ditampilkan non-interaktif secara elegan (CNT-04).
- ✅ **Promosi Terstruktur & Penjadwalan Waktu Nyata**: Filter promosi otomatis berdasarkan tanggal mulai (`starts_at`) dan akhir (`ends_at`) sesuai zona waktu Asia/Jakarta (WIB) (CNT-01, CNT-05).
- ✅ **Aksesibilitas & Kepatuhan UX**: Navigasi keyboard penuh (`:focus-visible`), modal aksesibel (focus trap, tombol `Escape`, pemulihan fokus), serta kepatuhan `@media (prefers-reduced-motion)` (GUE-14, CNT-06).
- ✅ **Antrean Offline & Dead-Letter Queue**: Toleransi gangguan sinyal dengan backoff eksponensial, idempotensi `event_id`, dan DLQ (GUE-11).
- ✅ **Transparansi Privasi**: Penjelasan jujur pemrosesan data teknis pseudonim dan masa retensi data (GUE-13).
- ✅ **Pemilih Bahasa EN/ID**: Tombol di hero; pilihan tamu disimpan di `localStorage` dan menang atas `language_mode` admin, tanpa reload (FR-V67-14).
- ✅ **Kontak Langsung**: Tautan Google Maps dan `tel:` di footer, dirender dari `general.address`/`general.phone` (FR-V67-13).
- ✅ **Fallback Tanpa JS & Offline**: `<noscript>` berisi nomor telepon, banner offline otomatis, dan fallback gambar rusak ke emoji tanpa inline handler (FR-V67-13/15/16).
- ✅ **PWA Instalable**: `manifest.json` + service worker men-cache aset statis (logo, foto gerai, CSS); navigasi network-first, portal admin sengaja tidak di-cache (FR-V67-16).

### Admin Portal (`/admin/`)
- ✅ **Status Sinkronisasi Jujur**: Indikator status penyimpanan cloud terpadu (*Belum disimpan*, *Menyimpan...*, *Tersimpan*, *Gagal menyimpan*) dengan tombol **Coba Lagi (Retry)** dan peringatan `beforeunload` saat ada perubahan belum tersimpan (SRC-01 s/d SRC-03).
- ✅ **Rotasi Kode Sumber Aman**: Rotasi kode mencabut kode lama secara otomatis, menandai kartu tidak terprogram, dan memberikan penanda "Perlu Cetak Ulang" (SRC-04, QRN-05).
- ✅ **Metrik & KPI Terbuka (Dashboard)**: Label jujur "Klik Google Review" dan "Rasio Klik Review / Kunjungan" dengan tooltip formula, data source, dan jendela waktu transparan (ANA-01 s/d ANA-05).
- ✅ **Leaderboard Terpisah**: Pemisahan tegas antara peringkat kinerja staf (`staff`/`sales`) dan gerai (`outlet`) agar titik meja/kartu operasional tidak mencemari peringkat F&B (ANA-08).
- ✅ **Ekspor Data Aman (Anti-CSV Injection)**: Pembersihan karakter awal berbahaya (`=`, `+`, `-`, `@`, `\t`, `\r`) pada file CSV (ANA-07).
- ✅ **Web NFC Multi-Tahap**: Pengecekan kompatibilitas browser, panduan fallback iOS/Desktop (via NFC Tools), dan visualisasi 4 tahap penulisan (QRN-03, QRN-04).
- ✅ **Normalisasi QR Code & Cetak**: Pembuatan URL QR tanpa double-slash dan tata letak cetak stiker/kartu dengan margin rapi (QRN-01, QRN-02).
- ✅ **Palet Desain Terkunci**: Menjaga integritas identitas kemewahan Hotel Bumi Surabaya (Deep Emerald `#1a3c2a`, Champagne Gold `#c9a96e`, Warm Ivory `#faf8f5`) (PRD 6.1, CNT-07).
- ✅ **Sesi Aktif & Reset Sandi Mandiri**: Daftar sesi per pengguna dengan tombol cabut; alur lupa sandi dua langkah berbasis kode email (FR-V67-14).
- ✅ **Audit Terpaginasi**: Paginasi server-side 100 baris + ekspor CSV yang mengikuti filter aktif (bukan hanya halaman terlihat) (FR-V67-14).
- ✅ **Upload Gambar & Bulk Edit Sumber**: Unggah gambar outlet/promo/CMS langsung ke Drive; pilih beberapa sumber sekaligus untuk aksi massal (FR-V67-14).

### Spesifikasi Terpadu Anti-Fraud (8 Aturan — AF-01 s/d AF-08)

| Kode | Aturan | Threshold Standar | Sanksi / Aksi |
|---|---|---|---|
| **AF-01** | Velocity Limit | >3 kunjungan / 24 jam ke sumber yang sama | `reduce_score` (Skor kualitas = 0) |
| **AF-02** | Burst Detection | ≥5 kunjungan dalam jendela 10 menit | `reduce_score` (Skor kualitas = 0) |
| **AF-03** | Self-Tap HP Staf | `device_id` cocok dengan tab `StaffDevices` | `reject_event` (Event ditolak/diabaikan) |
| **AF-04** | Low-Quality Dwell | Dwell time <5 detik & 0 interaksi | `reduce_score` (Skor kualitas = 0) |
| **AF-05** | Source Hopping | ≥4 sumber berbeda dalam 1 jam | `reduce_score` (Skor kualitas = 0) |
| **AF-06** | Bot Signal / Honeypot | Field tersembunyi terisi atau dwell <1 detik | `reject_event` (Event ditolak/diabaikan) |
| **AF-07** | Shared IP Flood | ≥10 device dari 1 IP dalam 10 menit (abaikan placeholder) | `flag_only` (Ditandai untuk audit) |
| **AF-08** | Odd Hours | Kunjungan di luar jam 06.00–23.00 WIB | `flag_only` (Ditandai untuk audit) |

---

## Keamanan & Kepatuhan Privasi

- **Pemisahan Konfigurasi Publik & Admin**: Endpoint `get_config` hanya mengekspos field aman yang diallowlist dan sumber yang aktif. Data sensitif dan threshold hanya dapat diakses dengan token sesi valid (SEC-08).
- **Penanganan IP Klien**: Backend mengabaikan parameter IP dari klien (`?ip=`) dan tidak mempercayai header spoofing (SEC-05).
- **Hashing Kriptografis**: Salt acak per-user dengan key stretching 1.000 iterasi SHA-256 (SEC-04).
- **Transparansi Privasi**: Menggantikan klaim tidak realistis "Zero-PII"/"anonim" dengan penjelasan jujur mengenai penggunaan identifier pseudonim (`device_id`, `session_id`) serta masa retensi data (12 bulan log mentah, 24 bulan agregat) (GUE-13, PRD 7.9).

---

## Catatan Kompatibilitas Web NFC

- **Didukung Native**: Google Chrome pada smartphone Android dengan fitur NFC aktif.
- **Perangkat iOS (iPhone) & Desktop**: Web NFC API (`NDEFReader`) belum didukung oleh browser Safari / iOS WebKit atau browser desktop. Gunakan tombol **Salin URL** di portal admin dan tuliskan ke kartu/tag NFC menggunakan aplikasi gratis seperti **NFC Tools** (tersedia di iOS App Store dan Google Play Store).

---

## Dokumentasi Terkait

- [SHEETS_SETUP.md](./docs/SHEETS_SETUP.md) — Panduan struktur spreadsheet database & bootstrap admin
- [DEPLOY.md](./docs/DEPLOY.md) — Panduan deployment GitHub Pages & Apps Script
- [ASSUMPTIONS.md](./docs/ASSUMPTIONS.md) — Batasan runtime GAS & asumsi arsitektur
- [PRD.md](./PRD.md) — Dokumen tunggal spesifikasi produk & status eksekusi (Fase 1 s/d v6.8)
- [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) — Log implementasi teknis & catatan redeploy backend (.gs)
