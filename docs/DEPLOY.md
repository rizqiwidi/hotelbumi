# DEPLOY.md — Panduan Deployment GitHub Pages & Google Apps Script

Panduan resmi deployment aplikasi **Bumi Surabaya Digital Guest Experience v6.0**.

> [!IMPORTANT]
> **Arsitektur Deployment**:
> - **Frontend**: Website statis di-deploy via **GitHub Pages dari root repository** (`main` branch) pada URL: `https://rizqiwidi.github.io/hotelbumi/`.
> - **Backend**: Google Apps Script Web App yang terhubung ke Google Sheets sebagai penyimpanan basis data. File backend (`backend/Code.gs` dan `backend/Triggers.gs`) di-deploy **secara manual** oleh pemilik/administrator di editor Apps Script.

---

## 1. Struktur Direktori Repository

Repository menggunakan struktur root statis tanpa framework dan tanpa build step:

```
hotelbumi/
├── index.html              ← Halaman tamu publik (GitHub Pages root)
├── admin/
│   └── index.html          ← Portal admin resmi (/admin/)
├── assets/
│   ├── css/
│   │   ├── guest.css       ← Styling halaman tamu (token palet warna resmi)
│   │   ├── admin.css       ← Styling portal admin
│   │   └── print.css       ← Styling cetak QR & stiker meja
│   ├── js/
│   │   ├── config.js       ← Konfigurasi publik & konstanta fallback
│   │   ├── guest/
│   │   │   ├── app.js          ← Logika presentasi tamu (aman XSS)
│   │   │   ├── tracking.js     ← Pelacak interaksi & beacon
│   │   │   ├── fingerprint.js  ← Pengenal pseudonim perangkat (device_id)
│   │   │   └── retry-queue.js  ← Antrean offline, backoff & dead-letter queue
│   │   └── admin/
│   │       ├── auth.js         ← Pengelola sesi login (username/password, 6h TTL)
│   │       ├── api.js          ← Klien API admin terproteksi token sesi
│   │       ├── dashboard.js    ← Visualisasi metrik & grafik tren
│   │       ├── staff-manager.js← Manajemen data staf & titik NFC
│   │       ├── anti-fraud.js   ← Engine evaluasi 8 aturan anti-fraud (AF-01 s/d AF-08)
│   │       └── web-nfc.js      ← Utilitas baca/tulis kartu Web NFC
│   └── images/             ← Logo dan foto gerai resmi
├── backend/
│   ├── Code.gs             ← Logika API, sesi kriptografis, hashing, rate limiting
│   ├── Triggers.gs         ← Laporan email otomatis & agregasi integritas
│   └── appsscript.json     ← Manifest Google Apps Script runtime
└── docs/
    ├── SHEETS_SETUP.md     ← Panduan struktur tab Sheets & bootstrap admin
    ├── DEPLOY.md           ← Panduan ini (GitHub Pages & GAS deployment)
    └── ASSUMPTIONS.md      ← Catatan teknis, limitasi runtime & asumsi
```

---

## 2. Deployment Backend (Google Apps Script Manual)

File backend berada di folder `backend/` dan memerlukan pembaruan manual di konsol Google Apps Script:

### Langkah Deploy Backend:
1. Buka spreadsheet Google Sheets resmi hotel.
2. Klik menu **Extensions** (Ekstensi) → **Apps Script**.
3. Di editor Apps Script:
   - Salin seluruh isi `backend/Code.gs` ke file `Code.gs`.
   - Salin seluruh isi `backend/Triggers.gs` ke file `Triggers.gs`.
   - Pastikan `appsscript.json` menggunakan runtime V8 dan zona waktu `Asia/Jakarta`.
4. Jalankan bootstrap administrator awal:
   - Di editor, pilih fungsi `setupInitialAdmin`.
   - Ubah parameter pemanggilan atau jalankan:
     ```javascript
     setupInitialAdmin('admin', 'PasswordKuatAnda2026!');
     ```
   - Klik **Run** dan berikan izin akses spreadsheet. Akun admin akan dibuat dengan flag `must_change = true`.
5. Deploy Web App:
   - Klik tombol **Deploy** → **New deployment**.
   - Pilih jenis: **Web app**.
   - **Execute as**: *Me (pemilik akun Google)*.
   - **Who has access**: *Anyone* (Siapa saja, termasuk tamu tanpa login Google).
   - Klik **Deploy**, lalu salin **Web App URL** (berakhiran `/exec`).
6. Siapkan Trigger Otomatis:
   - Di Apps Script, pilih menu **Triggers** (Ikon jam di sidebar kiri).
   - Tambahkan trigger mingguan untuk fungsi `laporanMingguan` (setiap Senin pukul 07.00 WIB).
   - Tambahkan trigger bulanan untuk fungsi `rekapBulanan` (tanggal 1 setiap bulan).

---

## 3. Deployment Frontend (GitHub Pages)

Frontend di-deploy langsung dari root repository GitHub:

1. Buka repository GitHub: `https://github.com/rizqiwidi/hotelbumi`.
2. Masuk ke **Settings** → **Pages**.
3. Pada bagian **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Klik **Save**.
5. Tunggu proses GitHub Actions Pages selesai. Website akan tayang di:
   ```
   https://rizqiwidi.github.io/hotelbumi/
   ```

---

## 4. Konfigurasi Pertama Kali di Portal Admin

Setelah frontend dan backend tayang:

1. Buka portal manajemen: `https://rizqiwidi.github.io/hotelbumi/admin/`.
2. Masuk menggunakan akun admin yang telah dibuat via `setupInitialAdmin`.
3. Jika akun diset dengan `must_change = true`, sistem akan meminta Anda mengganti password ke kata sandi baru.
4. Buka menu **Konfigurasi**:
   - Pastikan **URL Google Apps Script** terisi dengan Web App URL dari Langkah 2.
   - Klik **Simpan URL Backend** dan **Uji Koneksi Backend** untuk memverifikasi komunikasi.
5. Kelola Sumber & Staf:
   - Buka menu **Manajemen Staf & Titik NFC** untuk mendaftarkan staf hotel dan meja gerai.
   - Klik **Simpan & Sinkronkan ke Cloud**.
6. Atur Ambang Batas Anti-Fraud:
   - Buka menu **Audit Anti-Fraud & Integritas**.
   - Daftarkan perangkat staf hotel ke **StaffDevices (AF-03)** agar kunjungan uji coba staf tidak merusak metrik kualitas.

---

## 5. Prosedur Uji Coba (Smoke Test)

Lakukan pengujian berikut sebelum digunakan operasional:

### A. Uji Halaman Tamu
- Buka `https://rizqiwidi.github.io/hotelbumi/?source=staff-test`.
- Pastikan sapaan staf muncul sesuai kode sumber.
- Klik tombol ulasan Google Review.
- Periksa tab `Events_YYYY_MM` di Google Sheets untuk memastikan event `google_review_click` tercatat dengan `event_id` unik dan timestamp server.

### B. Uji Anti-Kecurangan (Anti-Fraud)
- Buka portal admin di `/admin/` dan buka tab **Audit Anti-Fraud**.
- Verifikasi ringkasan 8 aturan anti-fraud (AF-01 s/d AF-08).
- Uji pendaftaran HP staf: klik tombol **📌 Daftarkan HP Staf** pada baris event atau gunakan formulir pendaftaran manual. Pastikan status tersimpan ke server dan muncul di tabel `StaffDevices`.

### C. Uji Ketahanan Offline (Retry Queue & DLQ)
- Buka halaman tamu, aktifkan mode Airplane / matikan koneksi.
- Lakukan interaksi (misalnya klik promosi).
- Nyalakan kembali koneksi internet: antrean offline harus mengirimkan event secara otomatis dengan backoff eksponensial tanpa menduplikasi baris berkat idempotensi `event_id`.

---

## 6. Prosedur Pembaruan & Rollback

- **Pembaruan Frontend**: Cukup lakukan `git commit` dan `git push` ke branch `main`. GitHub Pages akan memperbarui situs dalam 1–2 menit.
- **Pembaruan Backend**: Edit kode di `backend/Code.gs` atau `backend/Triggers.gs`, lalu buat versi baru via **Deploy** → **Manage deployments** → **Edit** → **New version** → **Deploy**.
- **Rollback Frontend**: Lakukan `git revert` pada commit bermasalah dan push ke `main`.
- **Rollback Backend**: Di editor Apps Script, pilih versi deployment sebelumnya pada menu **Manage deployments**.
