# ASSUMPTIONS.md — Catatan Asumsi, Batasan Teknis & Kuota Platform v6.2 (Fase 2)

Dokumen ini mencatat asumsi arsitektur, batasan teknis platform, kuota layanan Google Apps Script / Google Sheets, matriks hak akses peran (RBAC), prosedur pemulihan darurat, serta rekomendasi kebijakan retensi data pada **Bumi Surabaya Digital Guest Experience v6.2 (Fase 2 — Operasional, Auditabilitas, dan Skala)**.

---

## A. Asumsi Autentikasi, Role-Based Access Control & Audit (SEC-11, SEC-12, SEC-01 s/d SEC-07)

### A-01 — Penegakan Izin Peran di Sisi Backend (SEC-11)
- Otorisasi dan validasi hak akses **ditegakkan secara mutlak di sisi backend (`Code.gs`)**, bukan sekadar penyembunyian elemen tombol di antarmuka (UI).
- Matriks Hak Akses Peran (*RBAC Matrix*):

| Peran (*Role*) | Akses Dashboard & Analitik | Manajemen Gerai & Promosi (Konten) | Manajemen Staf & Perangkat Staf | Ambang Batas Anti-Fraud & Konfigurasi | Jejak Audit (*AuditLog*) |
|---|:---:|:---:|:---:|:---:|:---:|
| `super_admin` | ✅ Penuh | ✅ Penuh | ✅ Penuh | ✅ Penuh | ✅ Penuh |
| `manager` | ✅ Penuh | ✅ Penuh | ✅ Penuh | ❌ Ditolak (`MUTATION_DENIED`) | ✅ Penuh |
| `content_editor` | ❌ Dibatasi | ✅ Penuh | ❌ Ditolak (`MUTATION_DENIED`) | ❌ Ditolak (`MUTATION_DENIED`) | ❌ Ditolak |
| `analyst_readonly` | ✅ Baca-Saja | ❌ Ditolak (`MUTATION_DENIED`) | ❌ Ditolak (`MUTATION_DENIED`) | ❌ Ditolak (`MUTATION_DENIED`) | ✅ Baca-Saja |

- Upaya mutasi yang melanggar hak peran akan dihentikan seketika dengan respon JSON `{ok: false, error: "MUTATION_DENIED: Peran ... tidak diizinkan..."}` dan dicatat ke dalam lembar `AuditLog` dengan status `DENIED`.

### A-02 — Jejak Audit (*Audit Trail* — SEC-11, PRD 7.9)
- Setiap tindakan sensitif (login berhasil/gagal, simpan konfigurasi gerai/promosi/sumber/perangkat staf/threshold fraud, perubahan kata sandi, dan prosedur pemulihan darurat) dicatat pada lembar `AuditLog` di Google Sheets.
- Atribut yang dicatat:
  - `ts_server`: Waktu server (ISO string & WIB)
  - `actor`: Nama pengguna yang melakukan tindakan
  - `role`: Peran aktor saat tindakan terjadi
  - `action`: Jenis tindakan (`LOGIN`, `MUTATION_SAVE_ALL`, `CHANGE_PASSWORD`, `BREAK_GLASS_RECOVERY`)
  - `target_object`: Objek atau domain yang dimutasi (`config`, `sources`, `promotions`, dll.)
  - `status`: Hasil mutasi (`SUCCESS`, `FAILED`, `DENIED`)
  - `details`: Rincian ringkas mutasi (daftar kunci yang diubah atau alasan penolakan)
  - `ip`: IP terdeteksi/disamarkan
- **Larangan Keras Rahasia Mentah**: Kata sandi (*plaintext password*), token autentikasi, atau salt kriptografis **dilarang keras** disimpan di dalam kolom rincian audit.

### A-03 — Prosedur Pemulihan Darurat / Break-Glass (SEC-12)
- Apabila kredensial seluruh administrator hilang atau terkunci akibat insiden keamanan, pemulihan darurat dilakukan melalui fungsi terdokumentasi `breakGlassRecovery(targetUsername, temporaryPassword)` di Google Apps Script editor.
- **Prinsip Break-Glass**:
  1. Dijalankan langsung oleh pemilik Google Workspace/Spreadsheet dari konsol Apps Script.
  2. **Tidak menghidupkan kembali password statis publik atau token backdoor**.
  3. Memaksa status `must_change = true` sehingga pemegang akun wajib memasukkan kata sandi baru pribadi saat login pertama kali.
  4. Menghapus sesi lama yang tersimpan di `CacheService` server.
  5. Mencatat tindakan pemulihan darurat ke dalam lembar `AuditLog` secara permanen.

---

## B. Batas Beban, Kuota Layanan & Strategi Skalabilitas (API-10, API-11)

Sistem menggunakan Google Sheets dan Google Apps Script (GAS) sebagai serverless backend tanpa biaya langganan bulanan. Agar operasional tetap andal saat volume transaksi meningkat, batas teknis berikut harus dipahami:

### B-01 — Batas Spreadsheet (Google Sheets Quota)
- **Kapasitas Sel Maksimum**: **10.000.000 sel** per spreadsheet (standar Google Workspace & akun Google personal per 2024–2026).
- **Proyeksi Pertumbuhan Data Bumi Surabaya**:
  - Tabel event bulanan (`Events_YYYY_MM`) memiliki 12 kolom per baris.
  - Asumsi 10.000 kunjungan/event per bulan = 120.000 sel per bulan.
  - Dalam 12 bulan (1 tahun) = ~1.440.000 sel.
  - Dibutuhkan waktu **> 6–7 tahun** operasional aktif sebelum mendekati ambang batas 10 juta sel.

### B-02 — Kuota Harian & Batas Waktu Eksekusi Google Apps Script (GAS Limits)
Berdasarkan dokumentasi resmi Google Workspace Quotas:
1. **Waktu Eksekusi Maksimum Per Request**:
   - Web App HTTP request (`doPost` / `doGet`): **30 detik** per panggilan.
   - Trigger Terjadwal (*Time-driven Triggers*): **6 menit** per eksekusi.
2. **Panggilan URL Fetch Harian**:
   - Akun Google Pribadi (gmail.com): 20.000 panggilan/hari.
   - Akun Google Workspace: 100.000 panggilan/hari.
3. **Eksekusi Konkuren Simultan**:
   - Maksimum 30 eksekusi skrip simultan secara bersamaan.
4. **Kuota Pengiriman Email Harian** (untuk trigger laporan mingguan):
   - Akun Google Pribadi: 100 penerima/hari.
   - Akun Google Workspace: 1.500 penerima/hari.

### B-03 — Strategi Saat Beban Mendekati Batas (*Mitigation & Scaling Strategy* — API-11)
1. **Pemisahan Tab Bulanan Otomatis**: Event dicatat ke tab `Events_YYYY_MM` secara otomatis per bulan, membatasi ukuran dataset aktif dalam satu lembar kerja.
2. **Client-Side Throttling & Caching**:
   - Tamu menyimpan `config` publik dalam memori selama sesi berjalan untuk mengurangi panggilan `get_public_config` berulang.
   - Retry request gagal menggunakan pola eksponensial dengan *Dead-Letter Queue* di `localStorage` klien untuk mencegah *thundering herd problem*.
3. **Pembersihan Cache Berkala**: CacheService digunakan secara efisien dengan ukuran kunci < 100 KB.
4. **Peringatan Batas Kapasitas**: UI admin menyediakan sinyal health dan metrik kegagalan event (DLQ count). Jika spreadsheet mencapai 5.000.000 sel, disarankan melakukan pengarsipan tahunan ke spreadsheet terpisah.

---

## C. Rekomendasi Kebijakan Retensi Data Otomatis (PRD 7.9)

> [!IMPORTANT]
> **PEMBERITAHUAN HUKUM & TATA KELOLA DATA**:
> Jadwal dan periode retensi di bawah ini merupakan **rekomendasi teknis** dari pengembang sistem dan **MEMBUTUHKAN PERSETUJUAN FORMAL DARI PEMILIK DATA / GENERAL MANAGER BUMI SURABAYA CITY RESORT** sebelum pemicu (*trigger*) otomatis penghapusan data diaktifkan di Google Apps Script (saat ini fungsi `jalankanRetensiData` berjalan dalam mode simulasi `dryRun = true`).

### Periode Retensi yang Direkomendasikan:
1. **Event Mentah (*Raw Events* — `Events_YYYY_MM`)**: **12 Bulan**
   - Data kunjungan, klik ulasan, dan klik WhatsApp lebih dari 12 bulan diarsipkan ke lembar agregat bulanan lalu dihapus dari lembar aktif.
2. **Rekapitulasi Agregat Bulanan (`MonthlyAggregates`)**: **24 Bulan (2 Tahun)**
   - Rangkuman total performa bulanan disimpan selama 2 tahun kalender untuk analisis perbandingan tahun-ke-tahun (*Year-over-Year*).
3. **Jejak Audit Mutasi (`AuditLog`)**: **12 Bulan**
   - Catatan siapa yang mengubah konfigurasi, login, dan pemulihan darurat disimpan minimal 1 tahun untuk audit kepatuhan.
4. **Log Teknis Skrip (`ScriptLog`)**: **3 Bulan (90 Hari)**
   - Log eksekusi teknis dan penanganan galat sementara dibersihkan setiap 90 hari agar tidak membebani ruang sel.

---

## D. Asumsi Hosting GitHub Pages & Runtime Vanilla

### D-01 — Hosting GitHub Pages dari Root Repository
- Platform di-deploy secara statis dari **root repository** branch `main` pada GitHub Pages: `https://rizqiwidi.github.io/hotelbumi/`.
- Tidak ada server Node.js, tidak ada reverse proxy Cloudflare, dan **tidak ada bundler/build tool** (Webpack, Vite, Rollup).
- Seluruh modul admin dipecah menjadi file JavaScript modular biasa yang dimuat langsung melalui tag `<script src="...">` standar peramban.

### D-02 — Palet Warna Resmi Resor (PRD 6.1)
- Identitas warna resmi hotel dikunci secara mutlak:
  - **Deep Emerald**: `#1a3c2a` / `#10261b`
  - **Champagne Gold**: `#c9a96e` / `#d4af37`
  - **Ivory / Cream**: `#faf8f5` / `#f5efe6`
  - **Charcoal Text**: `#1c2420`
- Setiap fitur baru pada Fase 2 (badge status health, indikator role, modal pratinjau, filter analitik) wajib mematuhi palet warna ini.
