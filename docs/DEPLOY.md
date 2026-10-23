# DEPLOY.md — Panduan Deployment, Rollback & Pemulihan Platform v6.8

Panduan operasional dan deployment resmi untuk **Bumi Surabaya Digital Guest Experience v6.8 (Fase 2 — Operasional, Auditabilitas, dan Skala)**.

> [!IMPORTANT]
> **Arsitektur Deployment Aktual**:
> - **Frontend**: Website statis di-deploy via **GitHub Pages dari root repository** (`main` branch) pada URL: `https://rizqiwidi.github.io/hotelbumi/`.
> - **Backend**: Google Apps Script (GAS) Web App terhubung ke Google Sheets sebagai basis data. File backend (`backend/Code.gs` dan `backend/Triggers.gs`) di-deploy **secara manual** oleh pemilik/administrator di Google Apps Script editor.

---

## 1. Struktur Direktori Repository v6.8 (Modular & Tanpa Build Step)

```
hotelbumi/
├── index.html                  ← Halaman tamu publik (GitHub Pages root)
├── manifest.json               ← Manifest PWA (ikon, warna tema, start_url)
├── sw.js                       ← Service worker cache aset statis halaman tamu
├── admin/
│   └── index.html              ← Portal admin resmi (/admin/)
├── assets/
│   ├── css/
│   │   ├── guest.css           ← Styling halaman tamu (token palet warna resmi)
│   │   ├── admin.css           ← Styling portal admin (sinyal health, tag peran, modal preview)
│   │   └── print.css           ← Styling cetak QR massal (kartu 85x55, tent A6, stiker 50x50, A4 grid)
│   ├── js/
│   │   ├── config.js           ← Konfigurasi publik & konstanta fallback
│   │   ├── guest/
│   │   │   ├── app.js          ← Logika presentasi tamu & deteksi draft preview (?preview=1)
│   │   │   ├── tracking.js     ← Pelacak interaksi & beacon
│   │   │   ├── fingerprint.js  ← Pengenal pseudonim perangkat (device_id)
│   │   │   └── retry-queue.js  ← Antrean offline, backoff & dead-letter queue
│   │   └── admin/
│   │       ├── admin-core.js       ← Central state manager, navigasi, auth & health signals
│   │       ├── admin-sources.js    ← CRUD staf & sumber, rotasi kode, slug preview
│   │       ├── admin-content.js    ← CRUD outlet, promosi, visibilitas seksi, draft preview
│   │       ├── admin-appearance.js ← Editor tema visual & kunci palet brand PRD 6.1
│   │       ├── admin-reports.js    ← Filter tren, preset favorit (ANA-10), cetak QR batch (QRN-06)
│   │       ├── admin-fraud-ops.js  ← Deteksi 8 fraud, StaffDevices, threshold, config backend
│   │       ├── admin-audit.js      ← Jejak audit & riwayat mutasi server (SEC-11, SEC-12)
│   │       ├── admin-nfc-ops.js    ← Programmer Web NFC & preview QR tunggal
│   │       ├── admin-init.js       ← Bootstrapper lifecycle, beforeunload & login/logout
│   │       ├── auth.js             ← Pengelola sesi login (username/password, 6h TTL)
│   │       ├── api.js              ← Klien API admin terproteksi token sesi (termasuk audit)
│   │       ├── dashboard.js        ← Visualisasi metrik & grafik tren (+ fallback teks jika Chart.js gagal)
│   │       ├── staff-manager.js    ← Pengelola data staf & titik NFC di storage
│   │       ├── anti-fraud.js       ← Engine evaluasi 8 aturan anti-fraud (AF-01 s/d AF-08)
│   │       └── web-nfc.js          ← Utilitas baca/tulis kartu Web NFC
│   └── images/                 ← Logo dan foto gerai resmi hotel
├── backend/
│   ├── Code.gs                 ← Logika API, otorisasi RBAC backend, AuditLog, break-glass
│   ├── Triggers.gs             ← Laporan email otomatis & trigger retensi data (dryRun)
│   └── appsscript.json         ← Manifest Google Apps Script runtime V8
└── docs/
    ├── SHEETS_SETUP.md         ← Panduan struktur tab Sheets, schema RBAC & bootstrap admin
    ├── DEPLOY.md               ← Panduan ini (GitHub Pages & GAS deployment)
    └── ASSUMPTIONS.md          ← Catatan asumsi, batasan kuota, dan retensi data
```

---

## 2. Prosedur Deployment Manual Backend (Google Apps Script)

Setiap ada perubahan pada file `backend/Code.gs` atau `backend/Triggers.gs`, pemilik sistem wajib memperbarui deployment di Google Apps Script:

1. Buka spreadsheet Google Sheets resmi hotel.
2. Klik menu **Extensions** (Ekstensi) → **Apps Script**.
3. Di editor Apps Script:
   - Ganti seluruh isi `Code.gs` dengan konten terbaru dari `backend/Code.gs`.
   - Ganti seluruh isi `Triggers.gs` dengan konten terbaru dari `backend/Triggers.gs`.
   - Pastikan file `appsscript.json` (jika terlihat di Project Settings) menyetel timezone `Asia/Jakarta`.
4. Jika memperbarui dari versi sebelumnya ke Fase 2:
   - Jalankan fungsi `_getOrCreateAuditSheet()` sekali untuk memastikan tab `AuditLog` dibuat otomatis dengan header resmi.
   - Tab `Users` otomatis menjadi 8 kolom (`username`, `password_hash`, `salt`, `must_change`, `created_at`, `updated_at`, `role`, `active`). Kolom `active` ditambahkan tanpa menghapus data; baris lama otomatis dianggap aktif.
5. Buat Deployment Baru / Perbarui Versi:
   - Klik tombol **Deploy** → **Manage deployments**.
   - Pilih deployment Web App aktif, klik ikon pensil (**Edit**).
   - Pada dropdown **Version**, pilih **New version**. Beri catatan deskripsi: `v6.8.0 — sesi aktif, reset sandi, upload gambar, paginasi audit, bulk sumber, PWA`.
   - Klik **Deploy**.
   - Salin **Web App URL** (URL berakhiran `/exec`).

---

## 3. Prosedur Deployment Frontend (GitHub Pages)

Deployment frontend berjalan otomatis saat commit di-push ke branch `main`:

1. Pastikan perubahan telah di-commit ke Git:
   ```bash
   git add .
   git commit -m "feat(p2): implement Phase 2 operations, audit trail, modular admin and reliability"
   git push origin main
   ```
2. GitHub Pages akan otomatis memperbarui file statis dalam 60–120 detik dari root repository.
3. Akses halaman tamu publik: `https://rizqiwidi.github.io/hotelbumi/`
4. Akses portal admin: `https://rizqiwidi.github.io/hotelbumi/admin/`

---

## 4. Sinyal Health Sistem di Portal Admin (PRD 8.3, 11E)

Setelah login ke portal admin, periksa bilah **Sinyal Health & Keandalan Operasional** di bawah bilah atas:

- **Status Backend**:
  - `🟢 Backend Terhubung`: Backend merespons normal dengan versi yang cocok.
  - `🔴 Backend Terputus / Belum Diuji`: URL backend belum diisi atau terjadi kegagalan jaringan.
- **Frontend Version**: Menampilkan versi klien statis (`v6.8.0`).
- **Backend Version**: Menampilkan versi yang dilaporkan oleh Google Apps Script (`v6.8.0`).
- **Waktu Server**: Menampilkan timestamp resmi server Google Apps Script (WIB) untuk mendeteksi drift jam lokal.
- **Dead-Letter Queue (DLQ)**:
  - `0 event gagal`: Seluruh beacon tamu berhasil dikirim ke server.
  - `> 0 event gagal`: Terdapat event yang gagal terkirim setelah maksimal 5 kali retry, tersimpan aman di antrean lokal peramban tamu.

---

## 5. Checklist Smoke Test Pasca-Deployment (Verification Gate)

Lakukan verifikasi langkah demi langkah segera setelah deployment selesai:

- [ ] **1. Halaman Tamu Normal**: Buka `https://rizqiwidi.github.io/hotelbumi/?source=staff-test`. Pastikan ucapan selamat datang dari staf muncul, gambar outlet tidak broken (fallback SVG/emoji aktif jika gambar gagal).
- [ ] **2. Tracking Beacon**: Klik tombol review Google. Periksa lembar `Events_YYYY_MM` di Google Sheets untuk memastikan baris baru tercatat dengan `event_id` unik.
- [ ] **3. Live Draft Preview (CNT-09)**: Buka `https://rizqiwidi.github.io/hotelbumi/?preview=1`. Banner kuning sticky pratinjau draft harus muncul di bagian atas layar.
- [ ] **4. Autentikasi Admin & Role Badge (SEC-11)**: Login ke `/admin/`. Pastikan badge peran pengguna (`Super Administrator`, `Manager`, `Editor`, atau `Analis`) tampil dengan benar di bilah sisi.
- [ ] **5. Penegakan Otorisasi Backend**: Coba simpan konfigurasi menggunakan akun `analyst_readonly` — permintaan harus ditolak oleh backend dengan notifikasi `MUTATION_DENIED`.
- [ ] **6. Jejak Audit Server (SEC-11, SEC-12)**: Buka tab **Jejak Audit** di portal admin. Klik **Perbarui Log** dan pastikan riwayat login dan mutasi tercatat lengkap di tabel dengan masked IP.
- [ ] **7. Cetak QR Massal (QRN-06)**: Buka tab **Cetak QR Massal**. Ubah format tata letak ke *Table Tent Lipat*, *Stiker Meja*, dan *A4 Grid*. Pastikan kode QR ter-render dengan sempurna tanpa galat konsol.
- [ ] **8. Fallback Chart Offline (GUE-14)**: Matikan koneksi internet atau blokir CDN Chart.js. Buka tab Dashboard, pastikan ringkasan tabel tren muncul menggantikan kanvas grafik.

---

## 6. Prosedur Rollback Deployment (Keandalan Operasional)

### A. Rollback Frontend (GitHub Pages)
Jika terdapat regresi fungsi atau kesalahan tampilan pada frontend:
1. Temukan commit stabil sebelumnya via riwayat git:
   ```bash
   git log --oneline -n 5
   ```
2. Lakukan revert pada commit yang bermasalah:
   ```bash
   git revert <commit-hash-yang-bermasalah>
   git push origin main
   ```
3. Tunggu 1–2 menit hingga GitHub Pages mem-publish ulang revisi sebelumnya.
4. Bersihkan cache peramban klien via *Hard Reload* (`Ctrl + Shift + R` atau `Cmd + Shift + R`).

### B. Rollback Backend (Google Apps Script)
Jika terjadi galat pada script backend yang baru di-deploy:
1. Buka spreadsheet Google Sheets → **Extensions** → **Apps Script**.
2. Klik tombol **Deploy** → **Manage deployments**.
3. Pilih deployment aktif, klik ikon pensil (**Edit**).
4. Pada dropdown **Version**, pilih nomor versi stabil sebelumnya (misalnya versi sebelum pembaruan).
5. Klik **Deploy**. Web App URL akan tetap sama, namun langsung kembali menjalankan kode versi sebelumnya dalam hitungan detik tanpa downtime.

---

## 7. Prosedur Teruji Pencadangan & Pemulihan Spreadsheet (*Backup & Restore*)

Basis data berada di Google Sheets, sehingga prosedur pencadangan dan pemulihan memanfaatkan infrastruktur Google Workspace:

### A. Prosedur Backup Rutin (Mingguan / Bulanan)
1. **Backup Otomatis Google Drive Version History**:
   - Google Drive secara otomatis menyimpan riwayat versi dokumen setiap kali terjadi perubahan.
   - Beri nama versi bersejarah: Buka spreadsheet → **File** → **Version history** → **Name current version** (mis. `Backup_Akhir_Bulan_2026_10`).
2. **Snapshot Salinan Spreadsheet Independen**:
   - Buka spreadsheet → **File** → **Make a copy** (Buat salinan).
   - Beri nama: `Bumi_Surabaya_DB_BACKUP_YYYY-MM-DD`.
   - Pindahkan salinan ke folder Google Drive khusus `Backups_Arsip_Hotel`.
3. **Ekspor File Dingin (*Cold Storage Export*)**:
   - Buka **File** → **Download** → **Microsoft Excel (.xlsx)**.
   - Simpan berkas `.xlsx` di penyimpanan aman offline sebagai arsip fisik.

### B. Prosedur Pemulihan (*Restore Step-by-Step*)
Jika spreadsheet rusak, terhapus sebagian, atau terjadi kekacauan formula/baris:
1. **Opsi 1: Restore dari Riwayat Versi (Paling Cepat)**:
   - Buka spreadsheet → **File** → **Version history** → **See version history**.
   - Pilih titik waktu sebelum kerusakan terjadi.
   - Klik **Restore this version** (Pulihkan versi ini).
2. **Opsi 2: Restore dari Dokumen Salinan Cadangan**:
   - Jika dokumen utama rusak total, buka salinan `Bumi_Surabaya_DB_BACKUP_YYYY-MM-DD`.
   - Buat salinan baru dengan nama spreadsheet utama resmi.
   - Buka **Extensions** → **Apps Script** pada spreadsheet baru tersebut.
   - Salin kembali file `backend/Code.gs` dan `backend/Triggers.gs`.
   - Deploy sebagai Web App baru dan salin Web App URL baru.
   - Buka portal admin di `/admin/`, masukkan URL baru di tab **Konfigurasi Backend**, lalu klik **Simpan URL Backend** dan **Uji Koneksi Backend**.
   - Lakukan uji login dan verifikasi tab `Users`, `AuditLog`, `Config`, dan `Sources`.
