# SHEETS_SETUP.md — Panduan Setup Google Spreadsheet sebagai Database

Dokumen ini menjelaskan langkah-langkah menyiapkan Google Spreadsheet sebagai database backend
untuk platform **Bumi Surabaya Digital Guest Experience v5.0**.

> [!IMPORTANT]
> Lakukan setup ini **sekali** sebelum deploy backend Apps Script.
> Backend (`Code.gs`) akan membuat tab yang belum ada secara otomatis saat pertama kali dipanggil,
> namun data seed awal pada tab `Config` dan `Sources` perlu diisi secara manual.

---

## 1. Buat Spreadsheet Baru

1. Buka [Google Drive](https://drive.google.com) → **+ Baru** → **Google Sheets**.
2. Beri nama file: `Bumi Surabaya — Digital Guest Database v5`.
3. Bagikan file hanya kepada akun Google yang akan menjalankan Apps Script (email staf IT / GM).

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
   | `fraud_thresholds` | `{"velocity_limit":3,"burst_count":5,"low_dwell_ms":5000,"hopping_sources":4}` | |

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
6. **Kolom K** (`whatsapp`): Khusus untuk tipe `sales` (format diawali `628`, contoh: `6281234567890`). Untuk staf biasa atau meja, biarkan kosong agar tombol WA tamu mengarah ke nomor WhatsApp concierge global hotel.
7. Bekukan baris 1.

---

## 3b. Buat Tab `Users` (Autentikasi Administrator v6.0)

> [!NOTE]
> Tab ini dikelola dan dibuat **secara otomatis** oleh `Code.gs` (`_getOrCreateUsersSheet()`) saat ada upaya login pertama kali jika belum ada.
> User awal: `widi` dengan password `946217` dan flag `must_change=TRUE` akan di-seed otomatis.

Jika ingin menyiapkan secara manual:
1. Tambah sheet baru, beri nama `Users`.
2. Isi baris pertama (header):

   | A | B | C | D | E | F |
   |---|---|---|---|---|---|
   | `username` | `password_hash` | `salt` | `must_change` | `created_at` | `updated_at` |

3. Keterangan kolom:
   - `username`: Nama pengguna admin (huruf kecil/angka/underscore, contoh: `widi`).
   - `password_hash`: SHA-256(salt + password) dalam format hex lowercase.
   - `salt`: String acak 16 karakter hexadesimal.
   - `must_change`: `TRUE` (wajib mengganti password sebelum akses dashboard dibuka) atau `FALSE`.
   - `created_at` & `updated_at`: Timestamp ISO / tanggal perubahan.

4. **Cara Reset Password Manual**:
   Jika administrator lupa kata sandi:
   - Buka Google Sheets ini → tab `Users`.
   - Hapus baris user yang lupa kata sandinya, atau hapus seluruh baris di bawah header.
   - Login ulang dari portal admin menggunakan kredensial default (`widi` / `946217`). Sistem akan melakukan auto-seed ulang dan mewajibkan penggantian kata sandi baru.

---

## 4. Buat Tab `StaffDevices`

1. Tambah sheet baru, beri nama `StaffDevices`.
2. Isi baris pertama (header):

   | A | B | C | D |
   |---|---|---|---|
   | `device_id` | `staff_code` | `label` | `registered_at` |

3. Tab ini **diisi otomatis** oleh portal admin saat manajer mendaftarkan HP staf.
   Tidak perlu seed data manual.

---

## 5. Buat Tab `Events_YYYY_MM`

> [!NOTE]
> Tab ini dibuat **secara otomatis** oleh `Code.gs` (`getOrCreateMonthlyEventsSheet()`)
> setiap kali ada event masuk pada bulan baru. Tidak perlu membuat manual.

Jika ingin membuat secara manual untuk pengujian, beri nama sesuai bulan, contoh: `Events_2026_10`.

Header kolom (urutan wajib sama persis):

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `event_id` | `session_id` | `device_id` | `ts_server` | `ts_client` | `event` | `source` | `source_type` | `ip` | `ua` | `screen` | `dwell_ms` | `interactions` | `scroll_max` | `fp` | `bot_flag` | `extra_data` |

---

## 6. Buat Tab `MonthlyAggregates`

1. Tambah sheet baru, beri nama `MonthlyAggregates`.
2. Isi baris pertama (header):

   | A | B | C | D | E | F | G | H | I | J |
   |---|---|---|---|---|---|---|---|---|---|
   | `month_key` | `source_code` | `source_name` | `source_type` | `total_visits` | `total_reviews` | `total_wa` | `total_promos` | `quality_score` | `fraud_events_flagged` |

3. Tab ini **diisi otomatis** oleh trigger `agregatBulanan()` setiap tanggal 1.

---

## 7. Buat Tab `ScriptLog`

1. Tambah sheet baru, beri nama `ScriptLog`.
2. Isi baris pertama (header):

   | A | B | C | D | E |
   |---|---|---|---|---|
   | `timestamp` | `level` | `action` | `message` | `ip` |

3. Tab ini **diisi otomatis** oleh seluruh fungsi di `Code.gs` dan `Triggers.gs`.

---

## 8. Pasang Apps Script

1. Buka Google Sheets yang baru dibuat.
2. Menu **Ekstensi → Apps Script**.
3. **Hapus** konten default di `Code.gs`.
4. **Salin-tempel** isi file `backend/Code.gs` dari repositori ini.
5. Buat file baru: **+ → Script file**, beri nama `Triggers`.
   Salin-tempel isi `backend/Triggers.gs`.
6. Buat file baru: `appsscript.json` (aktifkan dulu via **Project Settings → Show "appsscript.json"**).
   Salin-tempel isi `backend/appsscript.json`.
7. Klik 💾 **Simpan semua**.

---

## 9. Atur Script Properties

1. Di Apps Script Editor: **Project Settings (⚙️) → Script Properties → + Add property**.
2. Tambahkan:

   | Nama Property | Nilai Contoh | Keterangan |
   |---|---|---|
   | `READ_TOKEN` | `bs_rahasia_2026_xyz` | **Ganti dengan token acak yang kuat!** Ini adalah kunci akses admin. |
   | `EMAIL_MANAJEMEN` | `gm@bumisurabaya.com` | Email penerima laporan mingguan (boleh koma-separated) |

> [!CAUTION]
> **Jangan pernah hardcode `READ_TOKEN` di kode sumber.** Token ini hanya boleh ada di Script Properties dan di `sessionStorage` browser admin.

---

## 10. Deploy sebagai Web App

1. Di Apps Script Editor: klik tombol **Deploy → Kelola deployment → + Buat deployment baru**.
2. Isi konfigurasi:
   - **Tipe**: Web App
   - **Deskripsi**: `Bumi Surabaya v5.0 — Produksi`
   - **Jalankan sebagai**: `Saya (akun Google Anda)`
   - **Siapa yang dapat mengakses**: `Siapa saja, bahkan yang anonim`
3. Klik **Deploy**. Salin **URL Web App** yang muncul.
4. **URL Web App inilah** yang perlu dimasukkan ke field "GAS URL" di portal admin.

---

## 11. Pengujian Cepat

Buka URL Web App di browser (GET):

```
https://script.google.com/macros/s/[ID_DEPLOYMENT]/exec?action=get_config
```

Seharusnya mengembalikan JSON seperti:

```json
{
  "ok": true,
  "version": 1728392100,
  "config": { "general": { ... } },
  "sources": [ ... ]
}
```

---

## Pemeliharaan Berkala

| Frekuensi | Tindakan |
|---|---|
| **Setiap bulan baru** | Tab `Events_YYYY_MM` dibuat otomatis — tidak perlu aksi manual |
| **Setiap bulan (tanggal 1)** | Trigger `agregatBulanan()` menulis ringkasan ke `MonthlyAggregates` |
| **Setiap Senin** | Trigger `laporanMingguan()` mengirim email ke `EMAIL_MANAJEMEN` |
| **Jika spreadsheet lambat** | Pertimbangkan mengarsipkan tab `Events_` lama ke spreadsheet terpisah |
| **Rotasi READ_TOKEN** | Perbarui di Script Properties dan minta seluruh admin login ulang |
