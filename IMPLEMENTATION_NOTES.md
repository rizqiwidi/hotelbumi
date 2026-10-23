# IMPLEMENTATION NOTES — BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.8 (FASE 0–3 + W4/W5/W6)

Dokumen ini mendokumentasikan **PRD Fase 0 (P0 — Go-Live Blockers)**, **PRD Fase 1 (P1 — Kualitas Pengalaman dan Kelengkapan Fungsi)**, serta gelombang **W4/W5/W6** audit independen v6.8 untuk **Hotel Bumi Surabaya Digital Guest Experience v6.8**.

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

## 7. Ringkasan Implementasi Fase 2 (P2 — Operasional, Auditabilitas, dan Skala)

Implementasi Fase 2 mencakup penguatan operasional, tata kelola data, jejak audit, keandalan deployment, dan modularisasi arsitektur portal admin tanpa mengubah stack atau menambah build step:

### A. Modularisasi Controller Admin Monolitik (PRD 5 P2)
- Skrip inline berukuran >1.700 baris di `admin/index.html` berhasil dipecah menjadi 9 modul domain terpisah di `assets/js/admin/` yang dimuat via tag `<script src="...">` standar peramban:
  1. `admin-core.js`: State manager global (`BSAdmin.state`), toast helper, status sinkronisasi, navigasi tab, auth lifecycle, penegakan izin UI, dan sinyal health.
  2. `admin-sources.js`: Manajemen staf, gerai, dan titik NFC, rotasi token (SRC-04), dan sinkronisasi ke cloud.
  3. `admin-content.js`: Kurasi gerai F&B, promosi terjadwal (CNT-01 s/d CNT-08), pengaturan visibilitas seksi, dan live draft preview (CNT-09).
  4. `admin-appearance.js`: Pengaturan tema visual, teks hero, dan penguncian palet warna resmi hotel (PRD 6.1).
  5. `admin-reports.js`: Pengendali filter tren, preset filter favorit (ANA-10), ekspor CSV terproteksi formula injection, dan generator cetak QR massal (QRN-06).
  6. `admin-fraud-ops.js`: Tabel anomali anti-fraud, pendaftaran HP staf (`StaffDevices` — AF-03), pengaturan ambang batas fraud, pengujian koneksi backend, dan ganti kata sandi admin.
  7. `admin-audit.js`: Visualisasi dan pemfilteran log jejak audit mutasi server (`AuditLog` — SEC-11, SEC-12).
  8. `admin-nfc-ops.js`: Programmer Web NFC (`window.NDEFReader`), status interaktif 4-tahap, dan preview QR individual.
  9. `admin-init.js`: Bootstrapper lifecycle aplikasi, integrasi mobile sidebar, auto-resume sesi, peringatan `beforeunload`, dan event binding global.
- **Nol Regresi & Tanpa Build Step**: Seluruh antarmuka tetap berjalan menggunakan vanilla JavaScript, mempertahankan compatibility inline event handlers (`window.adminEditSource`, `window.adminRotateSource`, `window.adminMarkDevice`, dll.).

### B. Otorisasi Peran Berjenjang & Jejak Audit (SEC-11, SEC-12, SEC-10, SRC-09)
- **Penegakan Izin Backend (`backend/Code.gs`)**:
  - Didefinisikan 4 peran minimum: `super_admin`, `manager`, `content_editor`, `analyst_readonly`.
  - Backend memvalidasi `session.role` pada setiap operasi mutasi `save_all_admin_data`:
    - `analyst_readonly`: Ditolak seketika dengan respon error `MUTATION_DENIED`.
    - `content_editor`: Dibatasi secara ketat hanya boleh memodifikasi gerai, promosi, tampilan, dan visibilitas seksi tamu. Mutasi data staf atau threshold fraud ditolak.
    - `manager`: Diizinkan memodifikasi staf dan konten, namun ditolak jika mencoba memodifikasi threshold fraud atau konfigurasi sistem.
    - `super_admin`: Memiliki hak penuh mutasi seluruh domain.
- **Jejak Audit Mutasi Server (`AuditLog`)**:
  - Setiap operasi sensitif (login berhasil/gagal, simpan konfigurasi, ganti kata sandi, break-glass recovery) dicatat otomatis ke lembar `AuditLog` di Google Sheets via fungsi internal `_recordAudit`.
  - Kolom audit: `log_id`, `ts_server`, `actor`, `role`, `action`, `target_object`, `status`, `details`, `ip`.
  - Kata sandi mentah, token sesi, dan salt tidak pernah dicatat di log audit.
- **Pemulihan Darurat Teruji (Break-Glass Recovery — SEC-12)**:
  - Tersedia fungsi `breakGlassRecovery(targetUsername, temporaryPassword)` di `backend/Code.gs`.
  - Dijalankan langsung dari Google Apps Script editor saat seluruh akses terkunci.
  - Memaksa flag `must_change = true`, menghapus sesi aktif di cache server, dan mencatat aksi ke `AuditLog` tanpa menghidupkan kembali token backdoor publik.

### C. Operasional Data, Kuota & Prosedur Retensi (API-10, API-11, PRD 7.9)
- **Dokumentasi Batas Beban & Kuota**:
  - Terdokumentasi lengkap di `docs/ASSUMPTIONS.md` & `docs/DEPLOY.md`:
    - Google Sheets: Batas 10 juta sel (kapasitas operasional ~7 tahun untuk 10.000 event/bulan).
    - Google Apps Script: Timeout 30 detik untuk Web App, 6 menit untuk trigger terjadwal, kuota URL Fetch harian 20.000 (consumer) / 100.000 (Workspace), kuota email 100–1.500/hari.
    - Strategi mitigasi: Partisi tab bulanan (`Events_YYYY_MM`), caching lokal, Dead-Letter Queue eksponensial di klien, dan pengarsipan tahunan.
- **Kebijakan Retensi Data Otomatis (PRD 7.9)**:
  - Fungsi `jalankanRetensiData(dryRun)` diimplementasikan di `backend/Triggers.gs` dengan masa retensi:
    - Raw Events: 12 Bulan
    - Monthly Aggregates: 24 Bulan (2 Tahun)
    - AuditLog: 12 Bulan
    - ScriptLog: 3 Bulan (90 Hari)
  - Secara default berjalan dalam mode aman `dryRun = true` dan **ditandai sebagai rekomendasi yang membutuhkan persetujuan pemilik data / GM sebelum penghapusan fisik diaktifkan**.
- **Prosedur Teruji Backup & Restore Spreadsheet**:
  - Terdokumentasi lengkap di `docs/DEPLOY.md` dan `docs/SHEETS_SETUP.md`: Snapshot salinan Google Drive, ekspor Excel offline, serta langkah pemulihan versi dan penyambungan ulang Apps Script Web App.

### D. Keandalan Operasional & Sinyal Health (PRD 8.3, 11E)
- **Sinyal Health di UI Admin**:
  - Bilah status visual di bawah header menampilkan: Status backend (🟢 Terhubung / 🔴 Terputus), versi frontend statis (`v6.8.0`), versi backend Apps Script (`v6.8.0`), waktu server resmi (WIB), dan jumlah antrean event gagal (DLQ count).
- **Prosedur Rollback & Smoke Test**:
  - Terdokumentasi langkah rollback Git untuk frontend dan rollback versi deployment Apps Script untuk backend.
  - Checklist 8 butir smoke test pasca-deploy mencakup pengujian halaman tamu, beacon tracking, live draft preview, otorisasi RBAC, log audit, cetak QR, dan fallback offline Chart.js.

### E. Peningkatan Kebutuhan Operasional (GUE-14, CNT-09, ANA-10, QRN-06)
- **Live Draft Preview (CNT-09)**:
  - Tombol *"👁️ Preview Draft Tamu"* di tab Promosi & Outlet membuka modal pratinjau responsif dengan viewport switch (Mobile 414px / Desktop 100%).
  - Memanfaatkan parameter `?preview=1` dan `sessionStorage.getItem('bs_preview_config')` pada `assets/js/guest/app.js` untuk melihat draft perubahan sebelum diterbitkan ke tamu asli, disertai sticky alert banner mode draft.
- **Filter Favorit & Rentang Laporan Cepat (ANA-10)**:
  - Bilah preset analitik cepat di dashboard: Staf (7 Hari), Gerai (30 Hari), Semua (30 Hari).
  - Tombol simpan dan muat preset favorit kustom yang disimpan di `localStorage` peramban admin.
- **Cetak QR Massal Beragam Format (QRN-06)**:
  - 4 pilihan tata letak cetak fisik: Kartu Nama Staf (85x55mm), Table Tent Lipat A6 (105x148mm), Stiker Meja Compact (50x50mm), dan Lembar A4 Grid (8 kartu/halaman).
  - Filter pencarian teks langsung, filter tipe sumber, filter "Perlu Cetak Ulang Saja", dan filter "Sertakan Sumber Nonaktif".
- **Fallback Grafik Offline (GUE-14)**:
  - Jika CDN Chart.js gagal dimuat atau diblokir jaringan, sistem secara otomatis merender ringkasan tabel HTML tren harian di dalam kontainer grafik tanpa galat JavaScript.
  - Gambar outlet dan promosi dilengkapi penanganan `onerror` anggun dengan fallback SVG/emoji.

---

## 8. Catatan Deployment Manual Google Apps Script (.gs) untuk Pemilik

Pemilik/administrator wajib memperbarui file backend di Google Apps Script:

1. **`backend/Code.gs`**:
   - Salin seluruh isi file ke editor Apps Script.
   - Menyediakan endpoint baru `get_audit_logs`, penegakan otorisasi peran RBAC, fungsi `breakGlassRecovery`, `setupUser`, dan atribut kesehatan `system_health`.
2. **`backend/Triggers.gs`**:
   - Salin seluruh isi file ke editor Apps Script.
   - Menyediakan fungsi `jalankanRetensiData(dryRun)` dan penyelarasan URL footer email mingguan ke GitHub Pages.
3. **Deploy Versi Baru**:
   - Di editor Apps Script, klik **Deploy** → **Manage deployments** → **Edit** → pilih **New version** (deskripsi: `v6.8.0`) → klik **Deploy**.

---

## 9. Daftar Keputusan yang Membutuhkan Persetujuan Pemilik (PRD Bagian 12)

Sesuai PRD Bagian 12 (Keputusan & Pertimbangan Bisnis), item-item berikut telah diimplementasikan dengan aman dan kini menunggu keputusan / konfirmasi formal dari manajemen hotel:

1. **Kebijakan & Jadwal Retensi Otomatis Data Tamu (PRD 7.9)**:
   - *Status Saat Ini*: Diimplementasikan dalam mode simulasi (`dryRun = true`) di `backend/Triggers.gs`.
   - *Keputusan yang Dibutuhkan*: Persetujuan formal dari General Manager / DPO hotel mengenai rekomendasi masa simpan:
     - Apakah retensi raw events 12 bulan dan agregat bulanan 24 bulan disetujui untuk dihapus otomatis secara permanen dari spreadsheet?
     - Jika disetujui, pemilik dapat menjadwalkan trigger bulanan Apps Script untuk fungsi `jalankanRetensiData(false)`.
2. **Penugasan Akun & Peran Staf Operasional (SEC-11)**:
   - *Status Saat Ini*: Fondasi RBAC 4 peran aktif di backend dan UI admin. Akun admin utama default disiapkan sebagai `super_admin`.
   - *Keputusan yang Dibutuhkan*: Daftar username staf hotel yang akan didaftarkan sebagai `manager` (operasional harian F&B), `content_editor` (tim marketing promosi), dan `analyst_readonly` (analis internal / konsultan audit).
3. **Pemberitahuan Retensi & Privasi di Halaman Tamu (GUE-13)**:
   - *Status Saat Ini*: Menampilkan transparansi pemrosesan identifier pseudonim (`device_id` & `session_id`) tanpa klaim keliru "Zero-PII".
   - *Keputusan yang Dibutuhkan*: Peninjauan oleh tim legal/manajemen hotel apakah kalimat transparansi privasi di footer sudah selaras dengan kebijakan privasi korporat Bumi Surabaya City Resort.
4. **Pilihan Format Cetak Fisik Meja & ID Badge (QRN-06)**:
   - *Status Saat Ini*: 4 tata letak siap cetak tersedia di panel Cetak QR Massal (Kartu Nama, Table Tent Lipat A6, Stiker Meja 50x50mm, A4 Grid).
   - *Keputusan yang Dibutuhkan*: Pemilihan jenis material fisik (akrilik tent card, stiker vinyl anti-air, atau ID badge lanyard staf) oleh tim Housekeeping & F&B sebelum pencetakan massal dilakukan.


---

## 10. Gelombang W4/W5 — Guest & Aksesibilitas (v6.8)

Ringkasan perubahan setelah audit independen v6.8 (lihat `PRD_Perbaikan_Hotel_Bumi_Surabaya_v6.3.md` §9). Semua perubahan guest-side tanpa build step dan tanpa mengubah palet.

### A. Perbaikan Bug Guest
- **BUG-25 (`?lang=id`)**: `getMergedSection()` kini menumpuk preset ID di atas `DEFAULTS`, lalu hanya menimpa dengan nilai server yang benar-benar berbeda dari `DEFAULTS`. Teks server berbahasa Inggris tidak lagi mengalahkan preset ID.
- **BUG-37 (filter promo ganda)**: Filter tanggal hanya di backend (`Code.gs:747-755`, zona `Asia/Jakarta`). Klien hanya menyaring `active !== false`. Verifikasi batas tanggal: `ends_at` hari ini tetap tampil, `starts_at` hari ini tampil, tanggal lampau/masa depan dibuang.
- **BUG-38 (drift versi)**: Seluruh header modul, `footer_version_tag`, `index.html`, `admin/index.html`, `README.md`, `backend_version`, dan footer email mingguan (`Triggers.gs`) diselaraskan ke `v6.8`.
- **Fallback gambar**: atribut `onerror` inline (diblokir CSP `script-src` tanpa `'unsafe-inline'`) diganti listener delegasi pada `document` (`data-fallback-img`) di `app.js`. Placeholder emoji memakai atribut `hidden` + aturan CSS eksplisit.

### B. Aksesibilitas (FR-V67-10 s/d FR-V67-12)
- **Kontras**: token baru `--gold-text: #86682f` (4.77:1 di atas ivory, 5.20:1 di atas putih) dipakai untuk teks emas di latar terang (badge promo, harga, badge modal, label tipe gerai). Emas asli tetap untuk border, latar, dan tombol.
- **Tap target**: `.bs-star`, `.bs-lang-btn`, `.bs-outlet-action-btn`, `.bs-wa-sales-cta`, `.bs-footer-links a`, `.bs-footer-contact-link` minimal 44×44px. Modal & mobile bar memakai `env(safe-area-inset-*)`.
- **Semantik**: `<html lang>` mengikuti bahasa yang dirender; `role="radiogroup"` bintang mendukung ArrowLeft/Right/Up/Down + roving tabindex; `role="banner"` pada `<section>` dihapus; `role="list"` tanpa `listitem` dihapus; modal mengunci scroll latar dan memasang `inert` pada `#bs-main`.

### C. Fitur Guest Baru (FR-V67-13 s/d FR-V67-16)
- **Pemilih bahasa EN/ID** di hero (`#bs-lang-switch`). Pilihan disimpan di `localStorage` (`bs_lang_pref`), menghapus `?lang=` dari URL agar tidak menimpa pilihan, lalu `renderAll()` tanpa reload. Event `lang_switch` dikirim ke tracker.
- **Kontak footer**: tautan Google Maps (`Get Directions`) dan `tel:+62313545888`, dirender dari `general.address` / `general.phone`. Label peta dapat diubah lewat preset `footer_map_label`; `href` telepon tetap E.164 (`tel:+62313545888`) sementara teksnya diformat `+62 31 354 5888` oleh `formatPhoneDisplay()`. Tautan disembunyikan bila nomor/alamat kosong.
- **`<noscript>`**: pesan + nomor telepon + WhatsApp, menggantikan spinner abadi.
- **`og:image` + `og:url` + `twitter:card`** untuk pratinjau tautan.
- **Banner offline** (`#bs-offline-bar`) yang mengikuti event `online`/`offline`; bergeser di atas mobile action bar.

### D. Admin Portal
- `.adm-table` diberi `min-width: 640px` (wrapper sudah `overflow-x: auto`) agar tidak terhimpit di tablet.
- Breakpoint modal baru untuk rentang `481–768px` (dibatasi agar tidak menimpa aturan `≤480px`), dengan `env(safe-area-inset-bottom)` dan `align-items: flex-start` supaya modal panjang tetap bisa digulir.

### E. Verifikasi
- `node --check` pada seluruh modul `assets/js/**` + `backend/*.gs` (disalin ke `.js`): lolos.
- Smoke JSDOM: halaman tamu termuat tanpa galat, `inlineHandlers: 0`, pemilih bahasa mengubah `document.documentElement.lang` dan subjudul hero, banner offline bereaksi, fallback gambar memunculkan placeholder, promo filter batas tanggal lolos 6 kasus, kontak footer merender `href` + teks telepon yang benar.
- `formatPhoneDisplay()` diuji 5 kasus: `+62313545888` -> `+62 31 354 5888`, `08113388523` -> `+62 8113388523`, kosong -> kosong, `+628113388523` -> `+62 8113388523`, nomor non-Indonesia dikembalikan apa adanya.
- CSS: brace seimbang untuk `admin.css` + `guest.css`.
- **Belum diverifikasi visual di browser**: Chromium arm64 tidak tersedia di lingkungan ini (`Chrome for Testing does not provide linux/arm64 builds`), jadi bukti visual (kontras nyata, geser banner) belum diambil.

---

## 11. Gelombang W5 Admin & W6 Opsional (v6.8)

### A. FR-V67-14 — Fitur admin
- **Sesi aktif**: backend `_trackSessionToken`/`_readSessionIndex`/`_listActiveSessions`/`_revokeUserSessions(targetToken)` + aksi `list_sessions` & `revoke_session`. Indeks disimpan di `CacheService` (TTL 6 jam, maks 20 entri per user) — hanya 8 karakter awal token yang dikirim ke klien, cukup untuk mencocokkan tanpa membocorkan kredensial.
- **Reset sandi mandiri**: aksi publik `request_password_reset` (kode 6 digit via email, rate limited) + `confirm_password_reset`; `_revokeUserSessions(username, keepToken)` mematikan sesi lain saat sandi baru aktif.
- **Upload gambar**: aksi `upload_image` menyimpan berkas ke Drive dan mengembalikan URL publik; tombol `[data-upload-target]` menggantikan input path teks pada outlet, promo, dan CMS.
- **Paginasi audit**: `get_audit_logs` menerima `offset`/`limit` (maks 500), `action_filter`, dan `search`; baris dibaca dari bawah agar `offset` stabil walau ada baris baru. Tabel admin paginasi 100 baris/halaman.
- **Ekspor CSV audit**: mengambil **seluruh hasil terfilter** (limit 500), bukan hanya halaman terlihat. Kalau terpotong, toast menyebutkan total agar pengguna mempersempit filter. Karakter awal `=`,`+`,`-`,`@`,tab,CR diberi prefiks `'` (anti-CSV injection).
- **Date picker promo**: `<input type="date">` untuk `starts_at`/`ends_at`.
- **Bulk edit sumber**: checkbox `.adm-src-check` + select-all; bilah aksi massal (aktifkan/nonaktifkan/hapus) memakai endpoint bulk backend.
- **Backup penuh**: `exportConfigBackupJson()` sudah mencakup `config`, `sources`, dan `staff_devices`; impor memulihkan ketiganya lalu `save_all_admin_data`.
- **Guard idempoten**: `admin-audit.js` `init()` sekarang punya flag `_initialised` supaya DOMContentLoaded ganda tidak mengikat listener dua kali (offset paginasi tidak lagi melompat dua halaman).

### B. FR-V67-15 — Idempotensi `log_event`
- `event_id` dari klien dipertahankan; sebelum append, 200 baris terakhir diperiksa untuk `event_id` sama → `{ok:true, duplicate:true}` tanpa menulis ganda. Retry dari antrean offline/DLQ (`retry-queue.js`, `flushDeadLetterQueue`) memakai `event_id` asli sehingga aman diulang.
- Jendela 200 baris sengaja terbatas: retry terjadi dalam hitungan menit, bukan lintas bulan. Naikkan butuh index `event_id` terpisah.
- **Turnstile tidak dipasang** — butuh akun Cloudflare + site key milik hotel. Pengaman yang sudah jalan: rate limit global 300/menit, 60/menit per `device_id`, feedback 3/perangkat/24 jam, honeypot AF-06.

### C. FR-V67-16 — PWA
- `manifest.json` (standalone, `theme_color` `#1a3c2a`, ikon `favicon.svg` bertanda `maskable`) + `sw.js`.
- `sw.js` hanya menangani GET same-origin. Navigasi network-first (konten selalu segar, cache dipakai saat offline); aset statis cache-first dengan revalidasi di latar. Portal `admin/` sengaja **tidak** di-cache supaya staf selalu menerima JS terbaru.
- Registrasi di `app.js` hanya pada `http(s):` (abaikan `file://` dan `about:blank` di preview), dan kegagalan registrasi dibungkus `.catch()` agar tidak mengganggu render.
- Workflow Pages ikut menyalin `manifest.json` dan `sw.js` ke `_site/`.

### D. Verifikasi
- `node --check`: seluruh `assets/js/**`, `backend/Code.gs`, `backend/Triggers.gs`, `sw.js` — lolos.
- 14 skrip JSDOM/backend lolos: guest, admin, bahasa, modal+radiogroup, footer, filter promo, W5 (paginasi audit, sesi, bulk sumber, lupa sandi, upload), service worker (precache, activate, cross-origin/POST/admin dibiarkan lewat, navigasi network-first, aset cache-first), backend W3 (login, rate limit, sesi ganda, pencabutan setelah ganti sandi), retensi, penanda IP.
- **Belum diverifikasi visual di browser**: Chromium arm64 tidak tersedia di lingkungan ini (`Chrome for Testing does not provide linux/arm64 builds`). Instalasi PWA sesungguhnya (prompt "Add to Home Screen", perilaku offline penuh) juga belum diuji di perangkat nyata.
