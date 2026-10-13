# IMPLEMENTATION NOTES — BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.0 (FASE 0 & FASE 1)

Dokumen ini mendokumentasikan implementasi lengkap **PRD Fase 0 (P0 — Go-Live Blockers)** dan **PRD Fase 1 (P1 — Kualitas Pengalaman dan Kelengkapan Fungsi)** untuk **Hotel Bumi Surabaya Digital Guest Experience v6.0**.

---

## ⚠️ CATATAN DEPLOYMENT MANUAL (WAJIB DIBACA PEMILIK)

File backend Google Apps Script berikut **WAJIB di-deploy ulang secara manual** oleh pemilik/administrator di Google Apps Script Editor setiap kali ada perubahan backend:

### 1. **`backend/Code.gs`** (Pembaruan Fase 0 & Fase 1):
- Salin seluruh isi file `backend/Code.gs` ke editor Apps Script.
- **Pembaruan Fase 0**: Hashing password 1.000 iterasi SHA-256 (`pbkdf2_sha256$1000$...`), token acak kriptografis, penghapusan pintu darurat `READ_TOKEN`, penghapusan kredensial bawaan, pemisahan public config allowlist, endpoint `get_admin_data`, dan persistensi `StaffDevices`.
- **Pembaruan Fase 1**:
  - *Public Config Allowlist*: Penambahan field gerai terstruktur (`whatsapp`, `reservation_url`), field promo (`starts_at`, `ends_at`, `cta_label`, `cta_url`), dan filter otomatis promosi aktif berdasarkan rentang waktu timezone `Asia/Jakarta` (WIB) menggunakan `Utilities.formatDate`.
  - *Dwell Reconciliation (API-05)*: Peningkatan aksi `dwell_update` untuk melakukan pencarian menyeluruh pada kolom `session_id` di tab sheet bulanan aktif, bukan hanya baris terakhir, memastikan dwell time tercatat akurat meskipun ada event intervensi.
  - *Transparansi Batas Data (ANA-06)*: Endpoint `get_events_data` kini menyertakan `total_rows` dan `limit` dalam payload respons untuk mendukung pagination dan pencegahan pemotongan data diam-diam di dashboard admin.

### 2. **`backend/Triggers.gs`** (Pembaruan Fase 0 & Fase 1):
- Salin seluruh isi file `backend/Triggers.gs` ke editor Apps Script.
- **Pembaruan Fase 0**: Penyelarasan 8 aturan anti-fraud (AF-01 s/d AF-08) dengan parameter dinamis dari sheet `Config` dan klasifikasi aksi (`reject_event`, `reduce_score`, `flag_only`).
- **Pembaruan Fase 1**:
  - *Laporan Lintas Bulan (API-07)*: Fungsi `laporanMingguan()` kini menggunakan helper `_getEventsInRange(ss, startDate, endDate)` yang memindai semua partisi lembar `Events_YYYY_MM` yang beririsan dengan jendela 7 hari laporan, mencegah hilangnya data event pada pergantian bulan (mis. 28 Januari – 3 Februari).
  - *Idempotensi Agregasi Bulanan (API-08)*: Fungsi `agregatBulanan()` kini idempoten. Sebelum menulis baris agregat baru untuk suatu `monthKey`, baris lama untuk bulan tersebut dihapus terlebih dahulu, mencegah duplikasi metrik bila cron/trigger dieksekusi berulang kali.

### 3. **Inisialisasi Admin Pertama (Bootstrap)**:
- Jalankan fungsi `setupInitialAdmin(username, password)` dari editor Apps Script jika belum pernah dilakukan:
  ```javascript
  setupInitialAdmin('admin', 'PasswordKuatAnda2026!');
  ```
- Akun admin dibuat dengan status `must_change = true`, mewajibkan admin mengganti password saat login pertama kali.

### 4. **Deploy Versi Baru Web App**:
- Klik **Deploy** → **Manage deployments** → klik ikon pensil (**Edit**) pada deployment aktif → pada dropdown **Version**, pilih **New version** → klik **Deploy**.

---

## 1. Ringkasan Implementasi Fase 0 (P0)

| No | Modul / Requirement | Perubahan yang Diimplementasikan |
|---|---|---|
| 1 | **SEC-02, SEC-03, SEC-04** (`backend/Code.gs`) | Hapus kredensial default & auto-seed yang bisa ditebak (`widi`/`946217`). Ganti `Math.random` dengan `_generateSecureRandomHex(len)` (berbasis `Utilities.getUuid()` & SHA-256 bytes). Perkuat hash kata sandi dengan salt acak kriptografis + 1.000 putaran SHA-256 key stretching (`pbkdf2_sha256$1000$...`). Error login seragam dan timing-safe tanpa kebocoran akun. |
| 2 | **SEC-01, SEC-08, API-04** (`backend/Code.gs`) | Hapus backdoor `READ_TOKEN`. Pisahkan public config allowlist (`general`, `appearance`, `guest_sections`, `review_settings`, `whatsapp_settings`, `promotions`, `outlets`) dan hanya sumber aktif (`active === true`). Buat endpoint terproteksi `get_admin_data` untuk konfigurasi penuh, seluruh sumber, dan `StaffDevices`. |
| 3 | **SEC-05** (`backend/Code.gs`, `anti-fraud.js`) | Abaikan parameter klien `?ip=` dan payload `clientIp` pada backend. Rate limit login menggunakan username + global cache counter. Rate limit event menggunakan `device_id`. AF-07 mengabaikan placeholder IP (`client-ip`, `unknown`, `-`, kosong). |
| 4 | **SEC-06, SEC-07** (`admin/index.html`, `auth.js`, `api.js`) | Hapus input dan penyimpanan `READ_TOKEN` di panel admin. Pisahkan penyimpanan URL backend dari token sesi. Samakan informasi TTL sesi di UI dan client `auth.js` menjadi 6 jam (sesuai backend GAS). |
| 5 | **GUE-04** (`assets/js/guest/app.js`) | Hilangkan XSS: render sapaan personal hero via DOM API aman (`createTextNode`, `textContent`), implementasi `escapeHtml()` kontekstual pada promosi & outlet, serta validasi skema URL via `sanitizeUrl()` (tolak `javascript:`, `vbscript:`, `data:`). |
| 6 | **GUE-11, API-03** (`retry-queue.js`, `tracking.js`) | Respons HTTP 200 dengan `{ok:false}` tidak lagi dianggap sukses. Klasifikasi error retryable (network, timeout, rate limit) vs permanen (bad schema, invalid action). Implementasi idempotensi via `event_id` stabil. Catat event gagal total ke Dead-Letter Queue (`bs_dead_letter_queue` di localStorage). |
| 7 | **AF-ALL-01 s/d AF-ALL-03, PRD 7.7** (`anti-fraud.js`, `Code.gs`, `Triggers.gs`) | Satukan spesifikasi 8 aturan anti-fraud (AF-01 s/d AF-08) dengan ID, nama, threshold, window, severity, dan aksi terstandar (`reject_event`, `reduce_score`, `flag_only`). Mapping threshold dinamis dari sheet `Config`. |
| 8 | **SRC-08** (`admin/index.html`, `Code.gs`) | Pendaftaran HP Staf (`adminMarkDevice` dan form manual) benar-benar menyimpan ke tab `StaffDevices` di server melalui `BSApi.saveAllAdminData({ staff_devices })` dan menampilkan status persistensi secara visual. |
| 9 | **GUE-13, PRD 7.9** (`index.html`, `admin/index.html`, docs) | Perbaiki klaim privasi agar jujur: hapus klaim "Zero-PII"/"anonim", ganti dengan badge "Privasi Terjaga & Transparan", serta cantumkan secara rinci data pseudonim (`device_id`, `session_id`, resolusi, User-Agent, dwell time), tujuan evaluasi kualitas layanan, dan masa retensi data (12 bulan raw, 24 bulan agregat). |
| 10 | **PRD Bagian 9** (Dokumentasi) | Sinkronkan seluruh dokumentasi: ganti Cloudflare Pages dengan GitHub Pages dari root repo (`https://rizqiwidi.github.io/hotelbumi/`), hapus referensi model `READ_TOKEN`, perbarui `SHEETS_SETUP.md`, `DEPLOY.md`, `ASSUMPTIONS.md`, dan `README.md`. |

---

## 2. Ringkasan Implementasi Fase 1 (P1 — Kualitas Pengalaman & Kelengkapan Fungsi)

Implementasi Fase 1 berfokus pada 5 pilar utama sesuai PRD Bagian 10 dan requirement P1:

### A. Atribusi & Konten Publik
- **Resolusi Sumber Bertingkat (GUE-05, GUE-06, GUE-12)**:
  - Resolusi diprioritaskan: `Query URL (?source=)` > `Sesi Sebelumnya (dengan TTL 30 menit)` > `Default ('general')`.
  - Disimpan dalam `localStorage` / `sessionStorage` dengan timestamp kedaluwarsa 30 menit. Jika parameter baru dimasukkan di URL, sesi langsung diperbarui ke sumber baru.
  - Honeypot field anti-bot (`#bs-hp-field`) dihubungkan ke beacon tracking dan deteksi bot (AF-06).
- **Kurasi Outlet Aktif & Validasi Kontak (GUE-07, GUE-08, CNT-03, CNT-04)**:
  - Hanya gerai dengan status aktif (`active !== false`) yang dirender ke antarmuka tamu.
  - Setiap nomor kontak dibersihkan ke format internasional WhatsApp Indonesia (`628...`).
  - URL reservasi divalidasi skema protokol (`http:`, `https:`).
  - Bila outlet tidak memiliki kontak/URL valid, tombol kontak ditampilkan secara non-interaktif berlabel "Hubungi Concierge" tanpa memicu link rusak.
- **Promosi Terstruktur & Validasi Jadwal (CNT-01, CNT-02, CNT-05, CNT-08)**:
  - Struktur data promosi: `nama`, `deskripsi`, `emoji/gambar`, `outlet`, `starts_at`, `ends_at` (dalam timezone `Asia/Jakarta`), `cta_label`, `cta_url`, dan status `active`.
  - Promosi di luar rentang tanggal aktif otomatis disaring (tidak tampil di publik).
  - Modal editor promosi di admin menggunakan `Object.assign` untuk memastikan penyuntingan satu field tidak menghilangkan field lainnya secara tidak sengaja.

### B. Save & Sync Admin
- **Status Sinkronisasi Jujur (SRC-01 s/d SRC-03, SEC-09)**:
  - Menggantikan toast sukses optimistis dengan status bar sinkronisasi terpadu (`#adm-sync-indicator`):
    - `Tersimpan di Cloud`: setelah server mengonfirmasi respons `{ok: true}`.
    - `Menyimpan ke Cloud...`: saat pengiriman payload ke server sedang berlangsung.
    - `Belum disimpan`: saat ada modifikasi lokal pada sumber, gerai, promo, atau tampilan yang belum dikirim.
    - `Gagal menyimpan`: saat pengiriman gagal karena koneksi atau error server, dilengkapi tombol **Coba Lagi (Retry)**.
  - Listener `beforeunload` memperingatkan pengguna jika mencoba menutup tab atau me-reload halaman saat ada perubahan yang belum tersimpan.
- **Rotasi Kode Sumber Aman (SRC-04, SRC-07, QRN-05)**:
  - Fungsi rotasi kode (`rotateCode()`) secara default **mencabut (revoke)** kode lama.
  - Kode lama otomatis dipindahkan ke riwayat `revoked_codes`, status kartu diset `kartu_diprogram: false`, dan diberi penanda visual `needs_reprint: true` ("Perlu Cetak Ulang") agar staf operasional segera mengganti fisik kartu/stiker.
  - Sisi guest `app.js` menolak atribusi kode yang telah dicabut dan jatuh kembali ke sapaan default.

### C. Dashboard & Integritas Metrik (Analytics)
- **Label & Definisi KPI Terdokumentasi (ANA-01 s/d ANA-05)**:
  - Kartu metrik diperjelas:
    - `"Klik Google Review"` (menggantikan "Total Ulasan", dengan tooltip formula `COUNT(event == 'review_click')`).
    - `"Rasio Klik Review / Kunjungan"` (menggantikan istilah "Conversion Rate" yang ambigu, formula `(Klik Review / Total Kunjungan) * 100%`).
  - Setiap KPI memiliki tooltip penjelasan transparan (formula, sumber data, dan rentang jendela).
- **Transparansi Batas Data & State (ANA-06, ANA-07)**:
  - Antarmuka dashboard membedakan secara tegas state: *Memuat data*, *Kosong (Belum ada kunjungan)*, *Gagal memuat*, dan *Sesi berakhir*.
  - Menampilkan jumlah baris yang ditampilkan vs batas limit data (misal: "Menampilkan 100 event terakhir").
  - Ekspor CSV dilengkapi proteksi **Formula Injection (CSV Injection)**: setiap nilai sel yang diawali karakter berbahaya (`=`, `+`, `-`, `@`, tab `\t`, carriage return `\r`) diprefiks tanda kutip tunggal (`'`).
- **Pemisahan Leaderboard (ANA-08)**:
  - Leaderboard performa staf hanya mengelompokkan sumber bertipe `staff` atau `sales`.
  - Leaderboard gerai hanya mengelompokkan sumber bertipe `outlet`.
  - Titik meja dan kartu NFC operasional tidak lagi mencemari peringkat gerai F&B.

### D. QR Code, Web NFC, dan Cetak Fisik
- **Normalisasi URL QR (QRN-01, QRN-02)**:
  - Eliminasi bug double-slash (`//?source=`) melalui normalisasi `(origin + appRoot).replace(/\/+$/, '') + '/?source=' + code`.
  - Preview cetak stiker meja dan kartu menyertakan padding, margin standar, dan kontras tinggi untuk pemindaian optimal.
- **Web NFC Multitahap & Fallback (QRN-03, QRN-04)**:
  - Pengecekan kapabilitas `window.NDEFReader` saat tab NFC dibuka.
  - Banner kompatibilitas jelas: deteksi Chrome di Android untuk Web NFC, serta instruksi panduan aplikasi eksternal (NFC Tools) untuk pengguna iOS dan Desktop.
  - Visualisasi alur penulisan 4 tahap: *Menunggu izin* → *Siap menulis (dekatkan kartu)* → *Menulis data* → *Selesai / Gagal*.

### E. Desain, Aksesibilitas, dan UX (Design System)
- **Kepatuhan Palet Warna PRD 6.1**:
  - Palet kemewahan Hotel Bumi Surabaya dikunci secara permanen: Deep Emerald (`#1a3c2a`, `#10261b`), Champagne Gold (`#c9a96e`), Warm Ivory (`#faf8f5`, `#f6f5f0`), Charcoal (`#1c2420`).
  - Kontrol pemilihan warna sembarangan di panel admin diganti dengan kartu preview token warna resmi.
- **Aksesibilitas & Keyboard Navigation (GUE-14, CNT-06)**:
  - Seluruh tombol dan link interaktif memiliki ukuran target tap minimal 44×44px.
  - Indikator fokus keyboard `:focus-visible` dengan outline emas kontras tinggi (`2px solid #c9a96e`, offset 2px).
  - Modal aksesibel (`setupAccessibleModal`): penguncian fokus di dalam modal (*focus trap*), penutupan menggunakan tombol keyboard `Escape`, dan pengembalian fokus otomatis ke elemen pemicu saat ditutup.
  - Kepatuhan preferensi gerak: `@media (prefers-reduced-motion: reduce)` menonaktifkan animasi dan transisi berat di seluruh antarmuka tamu dan admin.
  - Desain sepenuhnya responsif tanpa *horizontal scrollbar* (overflow-x) dari 360px hingga 1440px.

---

## 3. Skema Tab Google Sheets

1. **`Config`**: Konfigurasi global hotel (format JSON key-value). Kunci sensitif `fraud_thresholds` diproteksi dan hanya disajikan ke admin terotentikasi.
2. **`Sources`**: Titik akses staf, meja, sales, dan kartu NFC (11 kolom termasuk `whatsapp`, `revoked_codes`, `needs_reprint`).
3. **`Users`**: Kredensial administrator (`username`, `password_hash`, `salt`, `must_change`, `created_at`, `updated_at`).
4. **`StaffDevices`**: Daftar perangkat HP staf terdaftar untuk aturan AF-03 (`device_id`, `staff_code`, `label`, `registered_at`).
5. **`Events_YYYY_MM`**: Log event mentah bulanan (`event_id`, `session_id`, `device_id`, `ts_server`, `ts_client`, `event`, `source`, `source_type`, `ip`, `ua`, `screen`, `dwell_ms`, `interactions`, `scroll_max`, `fp`, `bot_flag`, `extra_data`).
6. **`MonthlyAggregates`**: Rekapitulasi bulanan performa sumber dan skor kualitas (idempoten per `monthKey`).
7. **`ScriptLog`**: Log audit internal sistem.

---

## 4. Spesifikasi Terpadu Anti-Fraud (AF-01 s/d AF-08)

| ID | Nama Aturan | Parameter Default | Aksi Terstandar | Deskripsi |
|---|---|---|---|---|
| **AF-01** | Velocity Limit | max 3 event / 24 jam | `reduce_score` | Kunjungan dihitung, namun skor kualitas dinolkan |
| **AF-02** | Burst Detection | max 5 event / 10 menit | `reduce_score` | Deteksi tap beruntun dalam waktu singkat |
| **AF-03** | Self-Tap Staf | Cocok dengan `StaffDevices` | `reject_event` | Event diabaikan total dari kunjungan valid & skor |
| **AF-04** | Low-Quality Dwell | Dwell <5 detik & 0 interaksi | `reduce_score` | Kunjungan hampa tanpa membaca info hotel |
| **AF-05** | Source Hopping | >4 sumber / 1 jam | `reduce_score` | Perangkat berpindah-pindah banyak staf dalam 1 jam |
| **AF-06** | Bot Signal | Honeypot terisi / dwell <1 detik | `reject_event` | Event bot otomatis ditolak dari pencatatan |
| **AF-07** | Shared IP Flood | >10 perangkat / IP / 10 menit | `flag_only` | Ditandai untuk audit manual (abaikan placeholder IP) |
| **AF-08** | Odd Hours | Jam 23.00 – 06.00 WIB | `flag_only` | Ditandai untuk audit kunjungan larut malam |

---

## 5. Prosedur Pemulihan Kredensial Admin

Jika administrator lupa kata sandi:
1. Buka spreadsheet Google Sheets → menu **Extensions** → **Apps Script**.
2. Buka file `Code.gs`.
3. Jalankan fungsi `setupInitialAdmin`:
   ```javascript
   setupInitialAdmin('admin', 'PasswordBaruAnda123!');
   ```
4. Kredensial pengguna akan diperbarui di tab `Users` dengan salt kriptografis baru dan flag `must_change = true`.

---

## 6. Keterbatasan yang Masih Ada (Catatan untuk Fase 2)

1. **Dukungan Web NFC Browser**:
   - Web NFC API (`NDEFReader`) secara native saat ini hanya tersedia di browser Google Chrome pada perangkat Android dengan hardware NFC aktif.
   - Perangkat iOS (iPhone) dan browser desktop tidak menyediakan Web NFC API langsung; penulisan kartu NFC pada perangkat tersebut memerlukan aplikasi eksternal seperti *NFC Tools* dengan menyalin URL yang disediakan di portal admin.
2. **Kuota Eksekusi Google Apps Script**:
   - Runtime Google Apps Script memiliki batas waktu eksekusi 6 menit per panggilan fungsi dan batas kuota email harian (100–1.500 email tergantung tier Google Workspace). Laporan mingguan dan rekapitulasi bulanan sudah dioptimalkan agar berjalan dalam hitungan detik.
3. **Penyelarasan Multi-Admin Real-Time**:
   - Sinkronisasi konfigurasi antar-admin berbasis REST/HTTP request (polling & manual save status) dengan peringatan `beforeunload`, belum menggunakan WebSocket live-collaboration. Mode multi-admin simultan berpotensi menimpa data jika dua admin menyimpan perubahan di waktu yang bersamaan.
