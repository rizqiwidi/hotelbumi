# IMPLEMENTATION NOTES — BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.0

Dokumen ini mendokumentasikan implementasi lengkap logika aplikasi dan backend untuk **Hotel Bumi Surabaya Digital Guest Experience v6.0**, mencakup wiring sistem autentikasi baru, penataan data Google Sheets, endpoint Google Apps Script, routing WhatsApp sales, pencetakan QR massal, serta seluruh panel kontrol dashboard admin tanpa mengubah desain visual estetis Gemini.

---

## 1. Ringkasan Arsitektur & Perubahan v6.0

Pada versi 6.0, platform ditingkatkan dari sistem token manual statis menjadi sistem manajemen hotel mandiri dan aman (*Self-Contained Hospitality Platform*):

| Komponen | Versi Lama (v5) | Versi Baru (v6.0) |
|---|---|---|
| **Autentikasi Admin** | Input manual URL GAS & `READ_TOKEN` di login screen | Login berbasis **Username & Password**; GAS URL ditanam permanen |
| **Penyimpanan Kredensial** | Script Properties `READ_TOKEN` tunggal | Tab database Google Sheets `Users` dengan salted SHA-256 hash |
| **Sesi Admin** | Token statis di sessionStorage | Session token acak 32-hex di `CacheService` (TTL 6 jam) |
| **Kebijakan Password** | Tanpa rotasi paksa | Wajib ganti password pada login pertama (`must_change=TRUE`) |
| **Routing WhatsApp Tamu** | Selalu ke 1 nomor WhatsApp global | Terarah ke **WhatsApp Sales** penanggung jawab jika sumber bertipe sales |
| **Library QR Code** | Mengandalkan CDN eksternal | Library lokal `assets/js/admin/vendor/qrcode.min.js` (qrcodejs 1.0.0) |
| **Cetak QR Meja / Stiker** | Hanya satu per satu di tab NFC | Cetak massal (Bulk Print) multi-kartu meja / table tent via `print.css` |
| **Manajemen Konten** | Sebagian hardcoded di client | Full CRUD dari Dashboard: Outlets, Promosi, Tampilan, Fraud, Akun |

---

## 2. Skema Tab Google Sheets (`Users` & `Sources`)

### A. Tab Baru: `Users`
Tab ini dibuat dan di-seed secara otomatis oleh backend Apps Script saat login pertama jika belum tersedia.

**Struktur Kolom**:
```
A: username | B: password_hash | C: salt | D: must_change | E: created_at | F: updated_at
```

| Kolom | Tipe Data | Keterangan & Contoh |
|---|---|---|
| `username` | String | Username unik administrator (contoh: `widi`). |
| `password_hash` | String (Hex 64 char) | Hasil SHA-256 dari `salt + password` (lowercase hex). |
| `salt` | String (Hex 16 char) | Salt kriptografis acak unik per pengguna. |
| `must_change` | Boolean (`TRUE`/`FALSE`) | Jika `TRUE`, pengguna dilarang mengakses dashboard sebelum mengganti password. |
| `created_at` | DateTime / ISO | Waktu pembuatan akun admin. |
| `updated_at` | DateTime / ISO | Waktu pembaruan kata sandi terakhir. |

**Seed Awal Default**:
- Username: `widi`
- Password: `946217`
- Salt: string hex acak 16 karakter
- Hash: `SHA-256(salt + "946217")`
- `must_change`: `TRUE`

---

### B. Pembaruan Tab: `Sources`
Tab `Sources` diperluas dengan kolom ke-11 (`whatsapp`):

```
A: code | B: name | C: type | D: outlet | E: role | F: active | G: kartu_diprogram | H: legacy_codes | I: created_at | J: updated_at | K: whatsapp
```

- **Kolom K (`whatsapp`)**: Nomor WhatsApp individual sumber (format diawali kode negara tanpa tanda plus: `628xx`, contoh: `6281234567890`). Berlaku untuk tipe **Sales** maupun **Staff**; wajib diisi untuk sales, opsional untuk staf.
- **Aturan Bisnis**:
  - Untuk meja atau gerai (bukan orang), kolom ini dikosongkan.
  - Jika kosong, tombol WhatsApp di halaman tamu otomatis menggunakan nomor WhatsApp global hotel dari konfigurasi `whatsapp_settings.number` (`628113388523`).

---

## 3. Spesifikasi Endpoint Google Apps Script (`backend/Code.gs`)

Semua endpoint POST berformat JSON di body request (`Content-Type: text/plain;charset=utf-8` untuk menghindari pre-flight CORS di Apps Script).

### A. Endpoint `login` (Publik / Dilindungi Rate Limit)
- **Aksi**: `POST { action: "login", username: "...", password: "..." }`
- **Rate Limit**: Maksimal 10 percobaan per menit per alamat IP klien.
- **Logika**:
  1. Cari user di tab `Users`. Jika tab kosong, otomatis jalankan `_seedDefaultUser()`.
  2. Hitung digest SHA-256 dari `salt + password`.
  3. Cocokkan dengan `password_hash`. Jika cocok:
     - Buat session token 32 hex: `_generateRandomHex(32)`.
     - Simpan di `CacheService.getScriptCache()` dengan key `sess_<token>`, value JSON `{ username, role, must_change }`, TTL 21600 detik (6 jam).
     - Kembalikan `{ ok: true, token: "...", username: "...", role: "...", must_change: bool }`.

### B. Endpoint `change_password` (Terproteksi Sesi)
- **Aksi**: `POST { action: "change_password", token: "...", old_password: "...", new_password: "..." }`
- **Logika**:
  1. Verifikasi validitas token sesi di `CacheService` (mengizinkan pemanggilan saat `must_change=TRUE`).
  2. Verifikasi kesesuaian `old_password` terhadap hash saat ini.
  3. Buat salt acak baru 16-hex dan hash kata sandi baru.
  4. Perbarui baris user di tab `Users`: simpan `password_hash` baru, `salt` baru, set `must_change=FALSE`, dan `updated_at`.
  5. Perbarui sesi di `CacheService` dengan `must_change=FALSE`.
  6. Kembalikan `{ ok: true, message: "Kata sandi berhasil diperbarui." }`.

### C. Endpoint `save_all_admin_data` (Terproteksi Sesi Admin)
- **Aksi**: `POST { action: "save_all_admin_data", token: "...", config: {...}, sources: [...], fraud_settings: {...} }`
- **Verifikasi**: Ditolak jika token tidak valid atau jika `must_change=TRUE`.
- **Logika**:
  - Menggabungkan (*merge*) konfigurasi baru dengan baris konfigurasi lama di tab `Config` agar pembaruan parsial (misal: hanya Outlet atau Promosi) tidak menghapus kunci konfigurasi lainnya.
  - Menyimpan data `sources` ke tab `Sources` dengan 11 kolom lengkap (termasuk `whatsapp`).

### D. Endpoint `get_events_data` (Terproteksi Sesi Admin)
- **Aksi**: `POST { action: "get_events_data", token: "...", month: "Events_YYYY_MM", limit: 10000 }`
- **Verifikasi**: Ditolak jika token tidak valid atau jika `must_change=TRUE`.

### E. Fallback Darurat READ_TOKEN
Fungsi `_verifySession(token, allowMustChange)` memprioritaskan pengecekan sesi aktif di `CacheService`. Namun, bila tab `Users` sama sekali tidak dapat diakses atau kosong pada situasi pemulihan bencana (*disaster recovery*), backend tetap menyediakan pintu darurat dengan membandingkan token terhadap `ScriptProperties.READ_TOKEN` jika diset.

---

## 4. Alur Autentikasi Frontend (`admin/index.html` & `assets/js/admin/auth.js`)

1. **Konfigurasi URL Backend**:
   - `assets/js/config.js` menanam konstanta resmi:
     ```javascript
     var GAS_URL = 'https://script.google.com/macros/s/AKfycbwrx5XUk37A3uhIpqNjKR9u87Z5hfg6LcBBVkUKFfgKi16YZPrde37ks7r4IsHu__cL/exec';
     ```
   - Form login tidak lagi menanyakan URL GAS atau READ_TOKEN.
2. **Form Login**:
   - Input: `#adm-username` dan `#adm-password`.
   - Proteksi brute-force lokal: maksimal 5 kali gagal per 15 menit dengan lockout timer.
3. **Pemeriksaan `must_change`**:
   - Jika response login mengembalikan `must_change: true`:
     - Tampilkan modal `#adm-must-change-modal`.
     - Akses dashboard ditahan sampai pengguna memasukkan password lama dan menetapkan password baru (minimal 6 karakter).
     - Setelah sukses, modal ditutup dan dashboard dibuka.

---

## 5. Routing WhatsApp Sales & Halaman Tamu (`assets/js/guest/app.js`)

Ketika tamu mengakses URL `https://<domain>/?source=<code>`:

1. **Pendeteksian Sumber**:
   - `findSource(code)` mencari kecocokan slug di antara sumber aktif.
2. **Sapaan Personal**:
   - Untuk staf biasa (`staff`) maupun tim sales (`sales`), sapaan butler di hero berbunyi:
     `Halo! Anda saat ini dilayani dengan tulus oleh {nama} ({role}) dari {outlet}.`
   - Badge status `#bs-staff-badge` menampilkan `🪄 Dilayani oleh {nama}`.
3. **Routing Tombol WhatsApp**:
   - Jika sumber memiliki nomor WhatsApp valid (`whatsapp: "628xxx"`):
     - Nomor tujuan: nomor WhatsApp individual sumber tersebut (sales atau staf).
     - Template pesan otomatis:
       ```
       Halo, saya tamu Bumi Surabaya. Saya dilayani oleh {nama}.
       ```
   - Jika kolom `whatsapp` kosong (meja/outlet umum, atau staf tanpa nomor pribadi):
     - Nomor tujuan: fallback ke nomor WhatsApp concierge global hotel (`628113388523`).
     - Template staf: `Halo, saya tamu Bumi Surabaya. Saya baru saja dilayani oleh {staff_name} dan ingin melakukan reservasi.`
     - Template umum: `Halo Bumi Surabaya, saya ingin informasi mengenai reservasi dan layanan hotel.`

---

## 6. Modul Cetak QR Massal (`#tab-bulk-qr`)

Fitur cetak QR massal terintegrasi penuh di Panel 7 admin:
- **Pustaka Lokal**: Menggunakan `assets/js/admin/vendor/qrcode.min.js` (offline-ready, zero CDN dependency).
- **Target URL**: Dihasilkan saat runtime menggunakan origin browser:
  ```javascript
  var fullUrl = window.location.origin + '/?source=' + encodeURIComponent(s.code);
  ```
- **Pilihan Format**:
  1. **Format Kartu Stiker (85 x 54 mm)**: Layout kartu stiker meja elegan berbingkai emas, logo hotel, QR code 95x95, nama meja/staf, dan petunjuk tap/scan.
  2. **Format Table Tent Lipat (100 x 70 mm)**: Layout akrilik lipat dua sisi (sisi atas berputar 180° untuk dilipat, sisi bawah tegak lurus) dengan garis lipatan putus-putus.
- **Filter Fleksibel**: Dapat mencetak Semua Sumber, Khusus Staf, Khusus Sales, atau Khusus Meja/NFC.
- **Kepatuhan CSS Cetak**: Memanfaatkan aturan `@media print` dalam `assets/css/print.css` sehingga elemen navigasi, sidebar, dan header admin otomatis disembunyikan saat dialog cetak browser (`window.print()`) dibuka.

---

## 7. Panel Manajemen Terpadu Dashboard

Semua pengaturan disimpan ke Google Sheets melalui `BSApi.saveAllAdminData`:
1. **Manajemen Outlet F&B (`#tab-outlets`)**:
   - Tambah, edit, dan hapus gerai restoran hotel.
   - Pilihan foto lokal dari katalog: `/assets/images/outlets/arumanis.jpg`, `delikopi.svg`, `kizahashi.svg`, `lobby-lounge.jpg`.
   - Mengatur nama, kategori, highlight badge (misal: *Private Room 30 Pax*), jam operasional, dan status aktif.
2. **Nomor WhatsApp Sales (`#tab-sales-wa`)**:
   - Tabel direktori tim sales dan penanggung jawab unit bisnis hotel.
   - Tombol tambah sales baru yang otomatis membuka modal pembuatan staf tipe `sales`.
   - Form konfigurasi nomor WhatsApp concierge global dan template salam pembuka default.
3. **Promosi & Konten Halaman Tamu (`#tab-promos`)**:
   - Toggle visibilitas 5 seksi utama layar tamu: Google Review, WhatsApp Concierge, Gerai F&B, Penawaran Eksklusif, dan Media Sosial.
   - Tabel promosi aktif: Tambah, edit harga (nett/pax), gerai penyelenggara, dan periode berlaku.
4. **Tampilan & Tema (`#tab-appearance`)**:
   - Mengatur warna aksen identitas hotel (Champagne Gold / Deep Emerald).
   - Mengubah teks judul hero, sub-judul, pesan sambutan umum, dan salam sapaan staf.
5. **Ambang Batas Anti-Fraud (`#tab-config`)**:
   - Konfigurasi parameter algoritma deteksi anomali: Velocity Limit (AF-01), Burst Count (AF-02), Low Dwell Duration (AF-04), dan Hopping Sources (AF-05).
6. **Pengaturan Akun & Keamanan (`#tab-account`)**:
   - Form ganti kata sandi admin mandiri melalui pemanggilan endpoint `change_password`.

---

## 8. Panduan Reset Password Manual (Emergency Recovery)

Bila administrator kehilangan atau lupa kata sandi login, lakukan langkah pemulihan berikut langsung dari spreadsheet backend:

1. Buka spreadsheet Google Drive database proyek (**Bumi Surabaya — Digital Guest Database**).
2. Pilih tab **`Users`**.
3. **Opsi A (Reset Pengguna Tertentu)**:
   - Temukan baris dengan `username` = `widi`.
   - Hapus baris tersebut.
4. **Opsi B (Reset Total Kredensial)**:
   - Kosongkan seluruh baris di bawah header kolom tab `Users`.
5. Buka kembali halaman admin portal (`/admin/`).
6. Masuk menggunakan kredensial default bawaan sistem:
   - **Username**: `widi`
   - **Password**: `946217`
7. Sistem backend akan mendeteksi tab `Users` kosong, melakukan auto-seed ulang dengan salt acak baru, dan menandai `must_change = TRUE`.
8. Layar portal admin akan otomatis menampilkan modal pembaruan kata sandi untuk menetapkan password baru yang aman.

---

## 9. Verifikasi Kepatuhan & Integritas Desain

- [x] **Zero Visual Regression**: Seluruh class CSS, struktur hierarki, dan elemen layout rancangan Gemini dipertahankan utuh.
- [x] **Namespace Preservation**: Semua API global (`window.BSConfig`, `window.BSAuth`, `window.BSApi`, `window.BSStaffManager`, `window.BSAntiFraud`, `window.BSDashboard`, `window.BSWebNfc`) berfungsi secara serasi tanpa benturan penamaan.
- [x] **Zero Build Tool**: Seluruh kode ditulis dalam Vanilla JavaScript modern yang kompatibel langsung dengan browser mobile dan desktop tanpa bundling/transpiler.
- [x] **Zero External CDN Dependency**: Generator QR menggunakan skrip lokal `assets/js/admin/vendor/qrcode.min.js`.
