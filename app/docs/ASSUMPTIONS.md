# ASSUMPTIONS.md — Catatan Asumsi Implementasi

Dokumen ini mencatat seluruh asumsi yang diambil untuk bagian-bagian yang ambigu dalam PRD v5.0,
serta keputusan implementasi yang perlu diketahui oleh pengembang berikutnya.

---

## A. Aset yang Dilewati

### A-01 — `favicon.ico` (dilewati)
**Alasan**: PRD §4.1 menyebutkan `favicon.ico` namun tidak memberi spesifikasi desain.  
File `index.html` sudah mereferensikan `favicon.svg` sebagai fallback modern (SVG favicon didukung semua browser modern).  
**Tindakan yang disarankan**: Buat file `favicon.ico` 16×16px dan 32×32px dari `logo-gold.svg` menggunakan tool seperti `realfavicongenerator.net` dan tambahkan ke `/assets/images/`.

### A-02 — `default-hero.jpg` (dilewati)
**Alasan**: PRD §4.1 menyebutkan file ini namun tidak menyertakan gambar asli hotel.  
`guest.css` menggunakan gradient CSS fallback (`linear-gradient`) sebagai latar hero sehingga tampilan tetap elegan tanpa gambar.  
**Tindakan yang disarankan**: Sediakan foto hotel berkualitas tinggi (≤200 KB setelah kompresi WebP) dan referensikan di `config.js` → `appearance.hero_image_url`.

---

## B. Asumsi Autentikasi

### B-01 — Single-token, bukan multi-role
**PRD §8.5 FR-ADM-01** menyebutkan dua peran: *Super Admin* dan *Outlet Manager*.  
**Asumsi**: Implementasi saat ini menggunakan **satu READ_TOKEN tunggal** yang memberikan akses penuh (ekivalen Super Admin).  
Multi-role dengan akses terbatas per gerai bukan prioritas v5 (ditandai Opsional P2 di PRD §9) dan membutuhkan logika token terpisah di GAS.  
**Dampak**: Semua pengguna portal admin memiliki akses setara. Untuk pembatasan akses outlet manager, perlu token terpisah per peran di Script Properties.

### B-02 — Token disimpan di `sessionStorage` (bukan `localStorage`)
Token **tidak persisten** antar sesi (tab atau jendela browser yang baru). Ini adalah keputusan keamanan yang disengaja — sesuai PRD §8.5 FR-ADM-02.  
Admin harus login ulang setiap membuka tab baru atau setelah 8 jam.

---

## C. Asumsi Backend Google Apps Script

### C-01 — IP address di GAS
Google Apps Script tidak menyediakan IP address klien secara native di parameter `e` untuk Web App.  
**Asumsi**: Kolom `ip` di tab Events diisi dengan nilai `"client-ip"` sebagai placeholder.  
Untuk mendapatkan IP asli, diperlukan proxy middleware (misalnya Cloudflare Worker) yang meneruskan header `CF-Connecting-IP` sebagai query parameter `?ip=`.  
**Dampak**: Fitur AF-07 (Shared IP Flood) berfungsi di level frontend (sudah diimplementasi di `anti-fraud.js`) namun tidak di level server GAS.

### C-02 — Rate limiting berbasis `device_id`, bukan IP
Karena IP tidak tersedia di GAS (lihat C-01), rate limiting menggunakan `device_id` sebagai kunci.  
Ini cukup efektif untuk mencegah spam dari satu perangkat, namun tidak mencegah serangan yang menggunakan `device_id` palsu.

### C-03 — `dwell_update` hanya mencari 200 baris terakhir
Fungsi rekonsiliasi dwell (`_handleLogEvent`) mencari `session_id` yang cocok hanya dalam **200 baris terakhir** tab Events.  
**Asumsi**: Sesi kunjungan normal berlangsung singkat dan sessionnya pasti ada di 200 baris terakhir.  
Jika hotel memiliki lebih dari 200 kunjungan bersamaan (sangat tidak mungkin untuk hotel bintang lima skala ini), ada risiko kecil rekonsiliasi gagal dan dwell ditulis sebagai baris terpisah.

### C-04 — `appsscript.json` menggunakan `executeAs: USER_DEPLOYING`
Web App berjalan dengan identitas akun Google yang men-deploy skrip.  
**Asumsi**: Ini adalah akun IT hotel yang memiliki akses ke Spreadsheet database.  
Jangan gunakan `USER_ACCESSING` karena akan meminta izin dari setiap pengguna yang mengirim request.

---

## D. Asumsi Frontend

### D-01 — Chart.js dan QRCode.js dari CDN
Admin portal memuat Chart.js dan QRCode.js dari CDN jsDelivr.  
**Alasan**: Library ini hanya dibutuhkan admin, bukan tamu. Memuat dari CDN menjaga ukuran aset guest view tetap <40 KB.  
**Risiko**: Jika CDN tidak tersedia (jarang terjadi), dashboard charts dan QR preview tidak akan muncul.  
**Mitigasi**: Tambahkan fallback lokal jika dibutuhkan — copy `chart.umd.min.js` dan `qrcode.min.js` ke `/assets/js/vendor/`.

### D-02 — `generateQrDataUrl` menggunakan parameter `?source=`
Modul `staff-manager.js` menggunakan `?source=` sebagai nama parameter URL.  
Ini konsisten dengan seluruh kode `tracking.js` dan `app.js` yang membaca `?source=`.

### D-03 — Web NFC hanya tersedia di Android Chrome
`web-nfc.js` menggunakan `window.NDEFReader` yang saat ini **hanya tersedia di Google Chrome Android**.  
Pada iOS dan desktop, tombol "Tulis via Web NFC" akan dinonaktifkan secara otomatis dan panduan manual NFC Tools ditampilkan.

### D-04 — Tabel sumber di admin tidak di-paginate
Untuk hotel dengan >500 staf aktif, tabel sumber di tab "Staf & Sumber" mungkin terasa lambat.  
**Asumsi**: Hotel Bumi Surabaya memiliki staf lini depan dalam kisaran puluhan, bukan ratusan.  
Jika perlu pagination, implementasikan client-side pagination di `_renderSourcesTable()`.

---

## E. Asumsi Sekuriti

### E-01 — `READ_TOKEN` tidak di-rotate otomatis
Token rahasia diset manual di Script Properties dan berlaku indefinitely hingga diganti.  
**Rekomendasi**: Ganti READ_TOKEN minimal setiap 6 bulan atau saat ada pergantian staf IT.

### E-02 — Honeypot bernama `website_url_verification`
Field honeypot di `index.html` menggunakan name attribute `website_url_verification` — cukup umum agar bot sederhana mengisinya, tapi tidak terlalu terkenal sehingga bot canggih mungkin bisa menghindarinya.

---

## F. Asumsi Operasional

### F-01 — URL dasar guest view adalah `/` (root)
URL yang ditulis ke kartu NFC dan QR code menggunakan format:  
`https://[domain]/?source=[kode]`

Ini berarti `index.html` harus berada di root direktori deploy (`app/`), sesuai konfigurasi Cloudflare Pages dengan build output `app`.

### F-02 — Timezone WIB untuk semua timestamp server
Semua timestamp di GAS menggunakan `Asia/Jakarta` (WIB, UTC+7).  
Timestamp klien (`ts_client`) menggunakan UTC ISO string dari JavaScript `new Date().toISOString()`.

### F-03 — Email laporan menggunakan `GmailApp` (bukan SMTP eksternal)
Trigger email menggunakan `GmailApp.sendEmail()` — hanya bekerja jika akun Google yang men-deploy Apps Script adalah akun Gmail.  
Jika hotel menggunakan Google Workspace (G Suite), ini tetap berfungsi.

---

*Dokumen ini dibuat pada: **8 Oktober 2026**.*  
*Penulis implementasi: Antigravity AI Engineering Agent.*
