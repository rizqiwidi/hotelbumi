# IMPLEMENTATION NOTES — BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.0 (FASE 0 P0)

Dokumen ini mendokumentasikan implementasi lengkap **PRD Fase 0 (P0 — Go-Live Blockers)** untuk **Hotel Bumi Surabaya Digital Guest Experience v6.0**.

---

## ⚠️ CATATAN DEPLOYMENT MANUAL (WAJIB DIBACA PEMILIK)

File backend Google Apps Script berikut **WAJIB di-deploy ulang secara manual** oleh pemilik/administrator di Google Apps Script Editor:
1. **`backend/Code.gs`**:
   - Salin seluruh isi file ke editor Apps Script.
   - Berisi penguatan hashing password (1.000 iterasi SHA-256), token acak kriptografis, penghapusan pintu darurat `READ_TOKEN`, penghapusan kredensial default bawaan, rate limit yang tidak percaya IP klien, pemisahan public config allowlist, endpoint `get_admin_data`, dan persistensi `StaffDevices`.
2. **`backend/Triggers.gs`**:
   - Salin seluruh isi file ke editor Apps Script.
   - Berisi penyelarasan 8 aturan anti-fraud (AF-01 s/d AF-08) dengan parameter dinamis dari sheet `Config`, klasifikasi aksi (`reject_event`, `reduce_score`, `flag_only`), dan pengecualian placeholder IP.
3. **Inisialisasi Admin Pertama (Bootstrap)**:
   - Jalankan fungsi `setupInitialAdmin(username, password)` dari editor Apps Script:
     ```javascript
     setupInitialAdmin('admin', 'PasswordKuatAnda2026!');
     ```
   - Akun admin dibuat dengan status `must_change = true`, mewajibkan admin mengganti password saat login pertama kali.
4. **Deploy Versi Baru Web App**:
   - Klik **Deploy** → **Manage deployments** → **Edit** → pilih **New version** → **Deploy**.

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

## 2. Skema Tab Google Sheets

1. **`Config`**: Konfigurasi global hotel (format JSON key-value). Kunci sensitif `fraud_thresholds` diproteksi dan hanya disajikan ke admin terotentikasi.
2. **`Sources`**: Titik akses staf, meja, sales, dan kartu NFC (11 kolom termasuk `whatsapp`).
3. **`Users`**: Kredensial administrator (`username`, `password_hash`, `salt`, `must_change`, `created_at`, `updated_at`).
4. **`StaffDevices`**: Daftar perangkat HP staf terdaftar untuk aturan AF-03 (`device_id`, `staff_code`, `label`, `registered_at`).
5. **`Events_YYYY_MM`**: Log event mentah bulanan (`event_id`, `session_id`, `device_id`, `ts_server`, `ts_client`, `event`, `source`, `source_type`, `ip`, `ua`, `screen`, `dwell_ms`, `interactions`, `scroll_max`, `fp`, `bot_flag`, `extra_data`).
6. **`MonthlyAggregates`**: Rekapitulasi bulanan performa sumber dan skor kualitas.
7. **`ScriptLog`**: Log audit internal sistem.

---

## 3. Spesifikasi Terpadu Anti-Fraud (AF-01 s/d AF-08)

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

## 4. Prosedur Pemulihan Kredensial Admin

Jika administrator lupa kata sandi:
1. Buka spreadsheet Google Sheets → menu **Extensions** → **Apps Script**.
2. Buka file `Code.gs`.
3. Jalankan fungsi `setupInitialAdmin`:
   ```javascript
   setupInitialAdmin('admin', 'PasswordBaruAnda123!');
   ```
4. Kredensial pengguna akan diperbarui di tab `Users` dengan salt kriptografis baru dan flag `must_change = true`.
