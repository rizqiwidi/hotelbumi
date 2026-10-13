# SHEETS_SETUP.md — Panduan Setup Google Spreadsheet sebagai Database v6.2 (Fase 2)

Dokumen ini menjelaskan struktur skema Google Spreadsheet, konfigurasi hak akses pengguna (RBAC), jejak audit (*AuditLog*), dan pemulihan darurat (*break-glass*) untuk platform **Bumi Surabaya Digital Guest Experience v6.2 (Fase 2)**.

> [!IMPORTANT]
> Backend (`Code.gs`) akan secara otomatis membuat tab yang belum ada saat pertama kali dipanggil (termasuk tab `AuditLog` dan kolom `role` pada tab `Users`). Namun pemilik spreadsheet disarankan memverifikasi struktur awal dan membuat akun admin utama via `setupInitialAdmin`.

---

## 1. Ikhtisar Tab Spreadsheet Database

Spreadsheet resmi hotel terdiri dari tab-tab berikut:

| Nama Tab | Fungsi Utama | Dikelola Oleh |
|---|---|---|
| `Config` | Konfigurasi global hotel, visibilitas seksi, outlet, promosi, & ambang batas fraud | Portal Admin / Backend |
| `Sources` | Master data staf, titik meja, kartu NFC, dan nomor WA sales | Portal Admin (`admin-sources.js`) |
| `Users` | Kredensial akun admin dan penetapan peran RBAC (7 kolom) | Backend (`Code.gs`) |
| `AuditLog` | Jejak audit mutasi sensitif, login, dan pemulihan darurat | Backend (`Code.gs`) |
| `StaffDevices` | Daftar perangkat staf hotel untuk pengecualian self-tap (AF-03) | Portal Admin (`admin-fraud-ops.js`) |
| `Events_YYYY_MM` | Log event interaksi tamu bulanan | Otomatis dibuat backend per bulan |
| `MonthlyAggregates` | Rekapitulasi agregat performa bulanan staf & outlet | Trigger `rekapBulanan()` |
| `ScriptLog` | Log penanganan galat dan aktivitas internal skrip | Backend (`_logToSheet()`) |

---

## 2. Tab `Users` & Peran Pengguna (RBAC — SEC-11)

Tab `Users` menyimpan kredensial pengguna terenkripsi dengan salt kriptografis per-user dan 1.000 iterasi SHA-256 key stretching:

### Struktur Kolom Tab `Users` (7 Kolom):
1. `user_id`: ID unik pengguna (mis. `usr-1728800000000`).
2. `username`: Nama pengguna login unik.
3. `password_hash`: String hash password (`pbkdf2_sha256$1000$[salt]$[hash]`).
4. `salt`: Salt acak hexadesimal kriptografis (32 karakter).
5. `created_at`: Waktu pembuatan akun (ISO string).
6. `must_change`: `TRUE` atau `FALSE` (wajib ganti kata sandi sebelum akses).
7. `role`: Peran resmi pengguna:
   - `super_admin`: Akses penuh ke seluruh fitur dan konfigurasi sistem.
   - `manager`: Akses manajemen operasional harian (staf, perangkat, outlet, promosi), tanpa izin mengubah threshold fraud atau konfigurasi URL backend.
   - `content_editor`: Terbatas pada pengelolaan gerai F&B, promosi tamu, dan visibilitas seksi.
   - `analyst_readonly`: Hak akses hanya baca (read-only) untuk dashboard dan jejak audit.

### A. Membuat / Reset Akun Super Admin Pertama:
Di editor Google Apps Script, jalankan fungsi:
```javascript
setupInitialAdmin('admin', 'KataSandiKuat2026!', 'super_admin');
```
Akun akan dibuat dengan `must_change = true`.

### B. Membuat Akun Staf dengan Peran Lain (Manager, Editor, Analis):
Di editor Apps Script, gunakan fungsi `setupUser`:
```javascript
// Contoh membuat akun Manager:
setupUser('manager_fnb', 'PassManager2026!', 'manager');

// Contoh membuat akun Content Editor:
setupUser('editor_promo', 'PassEditor2026!', 'content_editor');

// Contoh membuat akun Analis Data (Readonly):
setupUser('analis_audit', 'PassAnalis2026!', 'analyst_readonly');
```

---

## 3. Tab `AuditLog` — Jejak Audit Mutasi Sensitif (SEC-11, SEC-12, PRD 7.9)

Tab `AuditLog` mencatat setiap aksi administratif sensitif secara permanen.

### Struktur Kolom Tab `AuditLog` (9 Kolom):
1. `log_id`: ID unik catatan audit (`aud-1728800000000-xxxx`).
2. `ts_server`: Waktu server (ISO string WIB).
3. `actor`: Username yang melakukan tindakan.
4. `role`: Peran aktor saat tindakan terjadi.
5. `action`: Jenis tindakan:
   - `LOGIN`: Upaya login (status: `SUCCESS` atau `FAILED`).
   - `MUTATION_SAVE_ALL`: Penyimpanan konfigurasi admin (status: `SUCCESS`, `FAILED`, atau `DENIED`).
   - `CHANGE_PASSWORD`: Perubahan kata sandi administrator.
   - `BREAK_GLASS_RECOVERY`: Pemulihan darurat akun terkunci.
6. `target_object`: Objek sasaran mutasi (`config`, `sources`, `promotions`, `fraud_settings`, dll.).
7. `status`: `SUCCESS`, `FAILED`, atau `DENIED`.
8. `details`: Ringkasan mutasi (daftar atribut yang diubah, tanpa password/token mentah).
9. `ip`: Alamat IP klien (disamarkan/masked).

---

## 4. Prosedur Pemulihan Darurat (*Break-Glass Recovery* — SEC-12)

Apabila kredensial seluruh administrator hilang, terkunci, atau disusupi:

> [!CAUTION]
> Jangan pernah membuat token rahasia *hardcoded* di kode sumber publik GitHub! Gunakan prosedur Break-Glass resmi berikut langsung dari konsol Google Apps Script:

1. Buka spreadsheet database hotel di Google Drive.
2. Masuk ke **Extensions** → **Apps Script**.
3. Di editor kode, pilih file `Code.gs`.
4. Pilih fungsi `breakGlassRecovery` pada menu dropdown run, atau tambahkan pemanggilan di fungsi sementara:
   ```javascript
   function jalankanBreakGlass() {
     breakGlassRecovery('admin', 'KataSandiDaruratSementara2026!');
   }
   ```
5. Klik tombol **Run**.
6. **Mekanisme Keamanan Break-Glass**:
   - Akun target akan langsung di-reset ke kata sandi sementara yang Anda berikan.
   - Status `must_change` disetel ke `TRUE` secara otomatis.
   - Seluruh token sesi lama pada server dihapus seketika.
   - Catatan tindakan `BREAK_GLASS_RECOVERY` dicatat ke lembar `AuditLog` dengan status `SUCCESS`.
7. Berikan kata sandi sementara tersebut kepada administrator resmi. Saat pertama kali login di `/admin/`, portal akan **mewajibkan** administrator membuat kata sandi baru pribadi sebelum portal dapat diakses.

---

## 5. Pemeliharaan & Prosedur Retensi Data (PRD 7.9)

### Fungsi Retensi Otomatis:
Di file `backend/Triggers.gs`, tersedia fungsi `jalankanRetensiData(dryRun)`.
- **Mode Simulasi Default (`dryRun = true`)**:
  - Memindai tab `Events_YYYY_MM` yang berumur > 12 bulan.
  - Memindai lembar `AuditLog` yang berumur > 12 bulan.
  - Memindai lembar `ScriptLog` yang berumur > 3 bulan.
  - Mencatat laporan simulasi ke `ScriptLog` tanpa menghapus baris fisik.
- **Pemberitahuan Persetujuan**:
  - Untuk menjalankan penghapusan fisik, pemilik data harus secara sadar memanggil `jalankanRetensiData(false)` atau menyetujui pemasangan trigger bulanan permanen.

---

## 6. Prosedur Backup & Restore Spreadsheet Database

### Langkah Backup:
1. **Google Drive Snapshot**: Klik **File** → **Make a copy** → simpan dengan nama `Bumi_Surabaya_DB_BACKUP_YYYY-MM-DD`.
2. **Download File Excel Offline**: Klik **File** → **Download** → **Microsoft Excel (.xlsx)**.

### Langkah Restore:
1. Buka berkas salinan cadangan di Google Drive.
2. Buka **Extensions** → **Apps Script**, verifikasi kode `backend/Code.gs` dan `backend/Triggers.gs`.
3. Deploy ulang Web App dan perbarui URL di tab **Konfigurasi Backend** portal admin.
