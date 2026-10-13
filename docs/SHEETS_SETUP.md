# SHEETS_SETUP.md — Panduan Setup Google Spreadsheet sebagai Database

Dokumen ini menjelaskan langkah-langkah menyiapkan Google Spreadsheet sebagai database backend
untuk platform **Bumi Surabaya Digital Guest Experience v6.0**.

> [!IMPORTANT]
> Lakukan setup ini sebelum menjalankan backend Apps Script.
> Backend (`Code.gs`) akan membuat tab yang belum ada secara otomatis saat pertama kali dipanggil,
> namun data seed awal pada tab `Config` dan `Sources` perlu diisi. Kredensial admin awal disiapkan via fungsi `setupInitialAdmin`.

---

## 1. Buat Spreadsheet Baru

1. Buka [Google Drive](https://drive.google.com) → **+ Baru** → **Google Sheets**.
2. Beri nama file: `Bumi Surabaya — Digital Guest Database v6`.
3. Bagikan file hanya kepada akun Google resmi yang menjalankan Apps Script (email staf IT / GM).

---

## 2. Buat Tab `Config`

1. Ganti nama **Sheet1** menjadi `Config`.
2. Isi **baris pertama (header)** dengan kolom berikut:

   | A | B | C |
   |---|---|---|
   | `key` | `value_json` | `updated_at` |

3. Isi **baris 2 dan seterusnya** dengan data konfigurasi awal hotel (format JSON String di kolom B):

   | key | value_json | updated_at |
   |---|---|---|
   | `general` | `{"hotel_name":"Bumi Surabaya City Resort","whatsapp":"628113388523","google_review_url":"https://g.page/r/CbSXVEVxrNXhEB0/review"}` | *(kosong, otomatis diisi backend)* |
   | `appearance` | `{"accent_color":"#c9a96e","hero_text":"Selamat Datang di Bumi Surabaya"}` | |
   | `guest_sections` | `{"show_review":true,"show_wa":true,"show_promotions":true,"show_outlets":true}` | |
   | `review_settings` | `{"review_url":"https://g.page/r/CbSXVEVxrNXhEB0/review","button_text":"Berikan Ulasan di Google ⭐"}` | |
   | `whatsapp_settings` | `{"number":"628113388523","template_staff":"Halo, saya tamu Bumi Surabaya. Saya dilayani oleh {staff_name}."}` | |
   | `promotions` | `[{"id":"promo-pasar-malam","name":"Pasar Malam Dinner Buffet","active":true}]` | |
   | `outlets` | `[{"id":"arumanis","name":"Arumanis Restaurant"},{"id":"kizahashi","name":"Kizahashi"}]` | |
   | `fraud_thresholds` | `{"velocity_limit":3,"burst_count":5,"low_dwell_s":5,"hopping_sources":4,"shared_ip_devices":10,"odd_hour_start":23,"odd_hour_end":6}` | |

4. **Bekukan baris 1**: Pilih baris 1 → Menu **Tampilan → Bekukan → 1 baris**.
5. **Validasi kolom A**: Kolom `key` tidak boleh duplikat.

---

## 3. Buat Tab `Sources`

1. Tambah sheet baru, beri nama `Sources`.
2. Isi baris pertama (header):

   | A | B | C | D | E | F | G | H | I | J | K |
   |---|---|---|---|---|---|---|---|---|---|---|
   | `code` | `name` | `type` | `outlet` | `role` | `active` | `kartu_diprogram` | `legacy_codes` | `created_at` | `updated_at` | `whatsapp` |

3. Isi data staf contoh awal:

   | code | name | type | outlet | role | active | kartu_diprogram | legacy_codes | created_at | updated_at | whatsapp |
   |---|---|---|---|---|---|---|---|---|---|---|
   | `staff-budi-santoso` | Budi Santoso | staff | Arumanis Restaurant | Head Waiter | TRUE | FALSE | `[]` | *(tanggal)* | | |
   | `sales-maya-lestari` | Maya Lestari | sales | Wedding & Banquet | Sales Manager | TRUE | FALSE | `[]` | *(tanggal)* | | `6281234567890` |
   | `arumanis` | Arumanis Restaurant | outlet | Arumanis Restaurant | | TRUE | FALSE | `[]` | | | |

4. **Validasi kolom A** (`code`): Wajib berformat slug URL-safe `^[a-z0-9-]+$`.
5. **Validasi kolom F** (`active`) dan kolom G (`kartu_diprogram`): Gunakan validasi data → Daftar: `TRUE, FALSE`.
6. **Kolom K** (`whatsapp`): Khusus untuk tipe `sales` (format diawali `628`). Untuk staf biasa atau gerai meja, biarkan kosong agar tombol WA tamu mengarah ke nomor WhatsApp concierge global hotel.
7. Bekukan baris 1.

---

## 3b. Tab `Users` & Inisialisasi Akun Admin (SEC-02, SEC-04)

Tab `Users` menyimpan kredensial administrator resmi dengan perlindungan salt acak kriptografis dan 1.000 iterasi SHA-256 key stretching:

1. Tab `Users` akan dibuat otomatis oleh backend jika belum ada dengan struktur kolom:
   - `username`: Nama pengguna unik admin.
   - `password_hash`: String hash terproteksi (`pbkdf2_sha256$1000$[salt]$[hash]`).
   - `salt`: Salt acak hexadesimal kriptografis.
   - `must_change`: `TRUE` atau `FALSE`.
   - `created_at` & `updated_at`: Waktu pembuatan dan pembaruan.

2. **Inisialisasi Admin Pertama (Bootstrap)**:
   Backend **tidak lagi menggunakan kredensial default atau auto-seed yang dapat ditebak**.
   Untuk membuat akun admin pertama:
   - Buka editor Apps Script.
   - Pilih fungsi `setupInitialAdmin`.
   - Jalankan fungsi dengan parameter yang diinginkan:
     ```javascript
     setupInitialAdmin('admin', 'KataSandiKuat2026!');
     ```
   - Akun akan dibuat dengan status `must_change = true`, mewajibkan admin mengganti kata sandi saat login pertama kali di portal.

3. **Reset Kata Sandi Jika Lupa**:
   Jalankan kembali fungsi `setupInitialAdmin(username, passwordBaru)` dari editor Apps Script untuk memperbarui password akun bersangkutan.

---

## 4. Buat Tab `StaffDevices` (AF-03, SRC-08)

1. Tambah sheet baru, beri nama `StaffDevices`.
2. Isi baris pertama (header):

   | A | B | C | D |
   |---|---|---|---|
   | `device_id` | `staff_code` | `label` | `registered_at` |

3. Tab ini dikelola oleh portal admin pada tab **Audit Anti-Fraud**. Setiap perangkat staf yang didaftarkan akan tersimpan permanen di sini untuk pengecualian self-tap (AF-03).

---

## 5. Tab `Events_YYYY_MM`

> [!NOTE]
> Tab ini dibuat **secara otomatis** oleh `Code.gs` (`getOrCreateMonthlyEventsSheet()`)
> setiap kali ada event masuk pada bulan baru.

Header kolom otomatis:
`event_id`, `session_id`, `device_id`, `ts_server`, `ts_client`, `event`, `source`, `source_type`, `ip`, `ua`, `screen`, `dwell_ms`, `interactions`, `scroll_max`, `fp`, `bot_flag`, `extra_data`.

---

## 6. Buat Tab `MonthlyAggregates`

1. Tambah sheet baru, beri nama `MonthlyAggregates`.
2. Isi baris pertama (header):

   | A | B | C | D | E | F | G | H | I | J |
   |---|---|---|---|---|---|---|---|---|---|
   | `month_key` | `source_code` | `source_name` | `source_type` | `total_visits` | `total_reviews` | `total_wa` | `total_promos` | `quality_score` | `fraud_events_flagged` |

3. Tab ini diisi otomatis oleh trigger `rekapBulanan()` setiap tanggal 1.

---

## 7. Buat Tab `ScriptLog`

1. Tambah sheet baru, beri nama `ScriptLog`.
2. Isi baris pertama (header):

   | A | B | C | D | E |
   |---|---|---|---|---|
   | `timestamp` | `level` | `action` | `message` | `ip` |

3. Tab ini diisi otomatis oleh fungsi `_logToSheet()` di backend untuk audit aktivitas sistem.

---

## 8. Pasang Apps Script

1. Buka Google Sheets → **Ekstensi → Apps Script**.
2. Salin isi `backend/Code.gs` ke file `Code.gs`.
3. Buat file script baru `Triggers`, salin isi `backend/Triggers.gs`.
4. Sesuaikan `appsscript.json` (aktifkan via **Project Settings → Show "appsscript.json"**).
5. Klik 💾 **Simpan semua**.

---

## 9. Atur Script Properties

1. Di Apps Script Editor: **Project Settings (⚙️) → Script Properties → + Add property**.
2. Tambahkan:

   | Nama Property | Nilai Contoh | Keterangan |
   |---|---|---|
   | `EMAIL_MANAJEMEN` | `gm@bumisurabaya.com` | Email penerima laporan mingguan & bulanan (boleh koma-separated) |

*(Catatan: Model lawas `READ_TOKEN` telah dihapus. Autentikasi sepenuhnya menggunakan sesi login terenkripsi di tab `Users`.)*

---

## 10. Deploy sebagai Web App

1. Klik **Deploy → New deployment**.
2. Konfigurasi:
   - **Type**: Web App
   - **Execute as**: `Me (akun Google Anda)`
   - **Who has access**: `Anyone`
3. Klik **Deploy**, lalu salin **Web App URL**.
4. Masukkan Web App URL ini pada menu Konfigurasi di portal admin `/admin/`.

---

## Pemeliharaan Berkala

| Frekuensi | Tindakan |
|---|---|
| **Setiap bulan baru** | Tab `Events_YYYY_MM` dibuat otomatis oleh backend. |
| **Setiap tanggal 1** | Trigger `rekapBulanan()` mengagregasi data performa ke `MonthlyAggregates`. |
| **Setiap Senin (07.00 WIB)** | Trigger `laporanMingguan()` mengirim email performa ke `EMAIL_MANAJEMEN`. |
| **Ganti Kata Sandi Admin** | Dilakukan langsung melalui menu Pengaturan Akun di portal admin atau via fungsi `setupInitialAdmin`. |
| **Pembersihan Log** | Arsipkan tab `Events_YYYY_MM` yang berumur lebih dari 12 bulan sesuai kebijakan retensi. |
