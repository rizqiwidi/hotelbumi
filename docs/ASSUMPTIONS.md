# ASSUMPTIONS.md — Catatan Asumsi & Batasan Platform v6.0

Dokumen ini mencatat asumsi arsitektur, batasan teknis platform, dan keputusan implementasi pada **Bumi Surabaya Digital Guest Experience v6.0**.

---

## A. Asumsi Autentikasi & Sesi (SEC-01 s/d SEC-07)

### A-01 — Autentikasi Berbasis Tab `Users` & Sesi Kriptografis
- Tidak ada lagi pintu darurat `READ_TOKEN` statis. Autentikasi sepenuhnya menggunakan verifikasi kredensial pengguna di tab `Users`.
- Kata sandi dilindungi salt kriptografis per-user dengan key stretching 1.000 putaran SHA-256 (`pbkdf2_sha256$1000$[salt]$[hash]`).
- Token sesi dibuat menggunakan generator hex acak kriptografis (32-karakter) dan disimpan di `CacheService` sisi server dengan masa berlaku (TTL) **6 jam**, disinkronkan dengan `sessionStorage` di sisi klien.
- Kegagalan login diproteksi rate limiting (maksimal 5 kali percobaan gagal per username / 15 menit). Pesan kesalahan bersifat seragam (`Nama pengguna atau kata sandi tidak valid.`) untuk mencegah *username enumeration*.

### A-02 — Batasan Kriptografi di Google Apps Script (GAS V8)
- Runtime Google Apps Script V8 tidak memiliki binding C native untuk bcrypt atau argon2, dan tidak mendukung WebCrypto `crypto.subtle`.
- Iterasi SHA-256 1.000 putaran via `Utilities.computeDigest` dipilih karena memberikan proteksi komputasi memadai terhadap *offline dictionary attack* sekaligus menyelesaikan eksekusi dalam waktu ~30 milidetik, jauh di bawah batas timeout eksekusi Google Apps Script (30 detik untuk web app).

---

## B. Asumsi Backend & Jaringan Google Apps Script (SEC-05, API-01 s/d API-04)

### B-01 — Penanganan Alamat IP Klien
- Google Apps Script Web App tidak mengekspos header IP klien asli pada parameter request `e`.
- Backend **secara tegas menolak dan mengabaikan** parameter `?ip=` atau field JSON `clientIp` yang dikirim dari klien browser untuk mencegah pemalsuan (*spoofing*) dan manipulasi rate limit.
- Kolom IP pada event diisi dengan nilai internal server atau dibiarkan kosong, dan disamarkan di dashboard.
- Aturan anti-fraud AF-07 (Shared IP Flood) mengabaikan nilai placeholder (`client-ip`, `unknown`, `-`, kosong).

### B-02 — Rate Limiting & Idempotensi
- Karena IP klien tidak dapat dipercaya, rate limit login diterapkan berbasis username dan global cache counter.
- Rate limit pencatatan event diterapkan per `device_id`.
- Idempotensi request dijamin melalui pengecekan `event_id` unik pada 200 baris terakhir tab Events aktif. Retry event dengan `event_id` yang sama akan merespons `{ok: true, duplicate: true}` tanpa menggandakan baris di spreadsheet.

### B-03 — Pemisahan Konfigurasi Publik & Admin (SEC-08)
- Endpoint publik `get_config` hanya mengembalikan konfigurasi publik aman yang diallowlist (`general`, `appearance`, `guest_sections`, `review_settings`, `whatsapp_settings`, `promotions`, `outlets`) dan hanya sumber dengan status `active === true`.
- Data sensitif seperti `fraud_thresholds`, `StaffDevices`, dan seluruh sumber (termasuk yang nonaktif) hanya disajikan melalui endpoint terotentikasi token admin valid (`get_admin_data` atau `get_events_data`).

---

## C. Asumsi Frontend & Hosting

### C-01 — Hosting GitHub Pages dari Root Repository
- Frontend di-deploy langsung dari **root repository** (`main` branch) pada GitHub Pages: `https://rizqiwidi.github.io/hotelbumi/`.
- Path aset diselesaikan secara otomatis relatif terhadap root path (`/hotelbumi/`) melalui fungsi `BSConfig.resolveAsset()`.
- Seluruh kode bersifat vanilla HTML, CSS, dan JavaScript tanpa framework atau build pipeline.

### C-02 — Web NFC di Android Chrome
- Fitur Web NFC memanfaatkan API modern `window.NDEFReader` yang saat ini didukung oleh Google Chrome di Android.
- Pada browser desktop atau iOS, tombol programmer Web NFC dinonaktifkan secara anggun dengan panduan alternatif aplikasi pihak ketiga (NFC Tools).

---

## D. Asumsi Privasi & Kepatuhan Data (GUE-13, PRD 7.9)

### D-01 — Transparansi Data Pseudonim vs PII Langsung
- Sistem tidak pernah meminta atau menyimpan data identitas pribadi langsung (Nama lengkap, nomor KTP/Paspor, email, atau kartu kredit).
- Sistem memproses identifier teknis pseudonim:
  1. `device_id` (disimpan di `localStorage` tamu) untuk integritas kunjungan dan pencegahan kecurangan (anti-fraud).
  2. `session_id` (disimpan di `sessionStorage`) untuk deduplikasi sesi kunjungan.
  3. Metrik perilaku teknis: waktu interaksi (dwell time), kedalaman scroll, dan titik sumber layanan.
- Istilah "Zero-PII" dan "anonim" tidak lagi digunakan secara keliru pada dokumentasi dan UI, melainkan digantikan dengan komitmen transparansi pengolahan data pseudonim dengan masa retensi:
  - Maksimal 12 bulan untuk raw events di Google Sheets.
  - Maksimal 24 bulan untuk rekapitulasi agregat bulanan.
