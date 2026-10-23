# PRODUCT REQUIREMENTS DOCUMENT (PRD) — Bumi Surabaya Digital Guest Experience
## Dokumen tunggal spesifikasi & status eksekusi — Fase 1 s/d v6.8

**Berkas ini adalah satu-satunya PRD proyek.** Dokumen pendahulunya (`docs/PRD.md`) sudah dilebur ke sini; isinya identik dengan §1–§8 di bawah.

| Atribut Dokumen | Rincian Spesifikasi |
| :--- | :--- |
| **Nama Sistem** | Bumi Surabaya — Digital Guest Experience |
| **Berkas tunggal** | `PRD.md` (root repo, tidak diterbitkan ke GitHub Pages) |
| **Tanggal & Status** | 23 Oktober 2026 — Final Engineering & Product Specification (Telah Diimplementasikan, revisi v6.8) |
| **Cakupan** | Fase 1 (`BUG-01` s/d `BUG-14`, `FR-ADM-01` s/d `FR-ADM-05`, `FR-CMS-01` s/d `FR-CMS-08`), Fase 4–6 (`FR-V64-01` s/d `FR-V65-05`, `FR-V66-ROLE-MENU`), dan audit independen v6.7/v6.8 (`BUG-16` s d. `BUG-38`, `FR-V67-01` s/d `FR-V67-16`) |
| **Basis audit terakhir** | Commit `5068a9e` (v6.5/v6.6) — 17.983 baris, diverifikasi langsung ke produksi |

## Kontrak Keras Desain Halaman Tamu (Zero Visual Change Policy)

Seluruh spesifikasi perbaikan dan fitur CMS di dalam PRD ini mematuhi **Kontrak Keras Tampilan Halaman Tamu**:
1. **DILARANG Mengubah Tone Warna Halaman Tamu (`index.html` & `assets/css/guest.css`):** Palet warna Deep Emerald (`#1a3c2a`, `#2d5a40`), Champagne Gold (`#c9a96e`, `#ddb97a`), Warm Ivory (`#f6f5f0`, `#e9e5da`), Charcoal (`#2c2c2c`, `#4a4a4a`), dan Pure White (`#ffffff`) beserta gradien yang sudah ada di halaman tamu dipertahankan 100% apa adanya.
2. **DILARANG Mengubah Layout Halaman Tamu (`index.html` & `assets/css/guest.css`):** Urutan seksi, struktur kartu, jarak *padding/margin*, tipografi (`Playfair Display` & `Inter`), serta responsivitas halaman tamu tidak diubah sedikit pun.
3. **Pemisahan Tegas Ruang Lingkup Visual:** Perombakan visual *Anti-Slop* hanya diterapkan pada **Portal Admin (`/admin/index.html` & `assets/css/admin.css`)**. Pada halaman tamu, fitur CMS hanya mengubah **isi konten/teks/tautan/visibilitas** yang dirender secara dinamis ke dalam struktur DOM halaman tamu yang sudah ada.

## 1. Ringkasan Eksekutif & Tiga Pilar Perbaikan v6.3

Audit menyeluruh tingkat baris terhadap seluruh 35 berkas di dalam `hotelbumi-terbaru.zip` mengidentifikasi tiga pilar utama yang telah diselesaikan pada rilis v6.3:
- **Pilar 1 — Remediasi 14 Bug Fungsional, Analitik, Keamanan & Integritas Data (`BUG-01` s/d `BUG-14`):** Memulihkan pustaka `qrcode.min.js` yang sebelumnya 0 byte, menyelaraskan kontrak JSON tab Jejak Audit, memperbaiki *crash* `TypeError` pada form ganti kata sandi admin, mencegah terhapusnya sumber nonaktif saat sinkronisasi melalui `BSStaffManager.initSources()`, memisahkan pemetaan threshold anti-fraud (`low_dwell_ms` vs `bot_min_dwell_ms`), mengoreksi jam operasional `AF-08` (`06.00–23.00 WIB`), serta mengamankan artefak GitHub Pages dan konkurensi `LockService`.
- **Pilar 2 — Standarisasi Portal Admin "Anti-Slop" (`FR-ADM-01` s/d `FR-ADM-05`):** Menghapus seluruh 40+ emoji kartun pada navigasi, kartu KPI, dan tombol tabel di `/admin/`, menggantinya dengan sistem ikon vektor SVG monoline (`BSAdmin.icon()`), membersihkan kebocoran kode tiket internal (`ANA-10`, `CNT-09`, `GUE-14`, `AF-03`, `PRD 6.1`, `REV-02`), menyelaraskan warna KPI & grafik `Chart.js` ke palet resmi Deep Emerald (`#1a3c2a`) dan Champagne Gold (`#b08f51`), menerapkan angka `tabular-nums`, serta menghapus 88 baris markup HTML *mock* statis pada `#adm-outlets-grid`.
- **Pilar 3 — CMS Pengelolaan Penuh Isi Tampilan Halaman Tamu (`FR-CMS-01` s/d `FR-CMS-08`):** Membangun skema `guest_content` dan antarmuka editor CMS 6-zona di Portal Admin sehingga administrator dapat mengelola 100% isi tampilan halaman tamu (Identitas Hotel, Logo, Loading Screen, Hero & 5 Sapaan Kontekstual, Google Review & Direct Feedback, Header/Template Gerai & Promo, WhatsApp Concierge & Modal Sales Picker, Sosial Media, Final CTA, Floating Mobile Bar, Footer, hingga isi lengkap Modal Kebijakan Privasi) lengkap dengan 8 toggle visibilitas seksi, *Live Draft Preview* (`?preview=1`), dan tombol *Kembalikan Teks Standar*.

## 2. Matriks Temuan Audit Kode Sumber (`BUG-01` s/d `BUG-14`)

### 2.1. Daftar Blocker Prioritas P0 (Blocker Fungsional & Risiko Kehilangan Data)

| ID | Berkas & Baris Kode | Akar Masalah Teknis (Root Cause) | Solusi Implementasi v6.3 |
| :--- | :--- | :--- | :--- |
| **BUG-01** | `assets/js/admin/vendor/qrcode.min.js` | Berkas pustaka lokal `qrcode.min.js` berukuran 0 byte (kosong), sehingga `window.QRCode` bernilai `undefined`. | Memaketkan pustaka *QRCode.js* v1.0.0 mandiri (32 KB) dengan dukungan Canvas, Image Data URL, dan SVG fallback (`FR-P0-01`). |
| **BUG-02** | `Code.gs`:1309 vs `admin-audit.js`:53, 106 & `admin/index.html`:1120 | Backend mengirim `logs` & `timestamp`, sedangkan frontend membaca `resp.audit_logs` & `log.ts_server`. Filter HTML memakai `MUTATION_SAVE_ALL` & `BREAK_GLASS_RECOVERY` yang berbeda dari kode aksi server. | Menyelaraskan `Code.gs` & `admin-audit.js` agar mendukung `logs`/`audit_logs` dan `timestamp`/`ts_server`, serta memperbarui daftar opsi filter aksi audit (`FR-P0-02`). |
| **BUG-03** | `admin/index.html`:1086 vs `admin-fraud-ops.js`:328, 338 & `Code.gs`:953 | HTML memakai `id="adm-acc-confirm-pw"`, tetapi JS memanggil `$id('adm-acc-cfm-pw').value` (`TypeError`). Validasi UI 6 karakter sedangkan backend wajib `>= 8` karakter. | Memperbaiki selector ke `#adm-acc-confirm-pw` dan menyamakan batas minimum kata sandi baru menjadi 8 karakter di seluruh form (`FR-P0-03`). |
| **BUG-04** | `admin-core.js`:401–407 vs `staff-manager.js`:292–316 | `admin-core.js` memanggil `BSStaffManager.initSources()` yang belum ada, sehingga jatuh ke `getPublicConfig()` yang membuang sumber nonaktif dan mereset `kartu_diprogram: false`. | Menambahkan `BSStaffManager.initSources()` dan memprioritaskan `getAdminData()` saat sesi admin aktif agar sumber nonaktif tidak pernah hilang saat sync (`FR-P0-04`). |
| **BUG-05** | `staff-manager.js`:204–213 vs `Code.gs`:619, 1099, 1221 | `rotateCode()` menulis `revoked_codes`, `migration_mode`, `migration_until`, dan `needs_reprint`, namun `Code.gs` hanya menyimpan 11 kolom di lembar `Sources`. | Memperluas skema lembar `Sources` menjadi 17 kolom di `Code.gs` dan meneruskan metadata migrasi aktif ke `_handleGetConfig()` (`FR-P0-05`). |
| **BUG-06** | `anti-fraud.js`:583 & `applyBot`:326–334 | `BACKEND_THRESHOLD_MAP` memetakan `low_dwell_ms: 'bot_min_dwell_ms'`, menimpa ambang bot (500 ms) menjadi 5000 ms (5 detik) dan menolak tamu asli yang klik tombol < 5 detik. | Memperbaiki pemetaan `low_dwell_ms: 'low_dwell_ms'` dan memperbarui `applyBot` agar hanya menandai spam event bertipe sama `< 500ms` (`FR-P0-06`). |
| **BUG-07** | `config.js`:167–168 vs `anti-fraud.js`:370 & `Triggers.gs`:186, 384 | `config.js` menyetel `odd_hour_start: 0, odd_hour_end: 5` sedangkan evaluator memakai logika jam operasional `hour < start || hour >= end` (24 jam penuh anomali di `Triggers.gs`). | Mengubah default ke `odd_hour_start: 6, odd_hour_end: 23` (jam operasional 06.00–23.00 WIB) dan menambahkan normalisasi otomatis nilai warisan `0..5` (`FR-P0-06`). |

### 2.2. Daftar Kelemahan Prioritas P1 & P2 (Analitik, Keamanan, Cetak & Operasional)

| ID & Prioritas | Berkas & Baris Kode | Rincian Temuan Audit | Solusi Implementasi v6.3 |
| :--- | :--- | :--- | :--- |
| **BUG-08 (P1)** | `anti-fraud.js`:184–232 & `Triggers.gs`:255–293, 416 | `AF-01` menghitung semua tipe event tanpa filter sumber; `AF-02` menggabungkan seluruh event se-hotel dalam bucket 10 menit; `Triggers.gs` belum menghitung `direct_feedback_submit` (+3) & `sales`. | Mengelompokkan `AF-01` per `device_id|source|event`, `AF-02` khusus `visit` per `source`, serta menambahkan skor `direct_feedback_submit` (+3) dan `sales` di `Triggers.gs` (`FR-P1-01`). |
| **BUG-09 (P1)** | `Code.gs`:1017–1033 & `tracking.js`:270–272 | Rekonsiliasi `dwell_update` menimpa baris terakhir ber-`session_id` sama tanpa memeriksa `event === 'visit'`, dan beacon dikirim ganda saat `pagehide` + `beforeunload`. | Memfilter rekonsiliasi `dwell_update` khusus ke baris `event === 'visit'` dengan `Math.max()`, menolak penyimpanan jika honeypot `hp` terisi, dan menambahkan cooldown 1.000 ms pada `sendDwellBeacon()` (`FR-P1-02`). |
| **BUG-10 (P1)** | `.github/workflows/static.yml`:37–40 | GitHub Actions mengunggah seluruh direktori repositori (`path: '.'`) ke GitHub Pages sehingga `backend/Code.gs` dan `docs/*` terekspos ke publik. | Menyalin hanya `index.html`, `admin/`, dan `assets/` ke direktori `_site/` sebelum `upload-pages-artifact` (`FR-P1-03`). |
| **BUG-11 (P1)** | `Code.gs`:1079, 1180–1265, 1319 & `admin-core.js`:221 | Operasi tulis Sheets belum dilindungi `LockService`; `get_events_data` tidak memblokir `content_editor`; UI hanya menurunkan `opacity` tab tanpa memblokir `switchTab()`. | Membungkus operasi tulis `Code.gs` dengan `LockService.getScriptLock()`, membatasi akses baca `content_editor` di server, dan memblokir `switchTab()` di `admin-core.js` (`FR-P1-04`). |
| **BUG-12 (P1)** | `admin-reports.js`:205, `admin-nfc-ops.js`:209, `print.css`:98 | `renderBulkQr()` menghapus class `adm-bulk-preview-grid`; tombol cetak di tab NFC mencetak seluruh form halaman. | Mempertahankan class `adm-bulk-preview-grid`, membungkus QR tunggal dengan `.adm-print-card-sample.print-card`, dan mengisolasi cetak kartu tunggal via `body.print-single-qr` (`FR-P1-05`). |
| **BUG-13 (P2)** | `guest/app.js`:600–613, 707 & `guest.css`:203–216 | Payload `submit_feedback` belum menyertakan `hp`; `getSalesList()` membuang `role`/`outlet`; `.bs-star.active` merujuk ke `--gold` & `--ink` yang belum ada di `:root`. | Menyertakan `hp` pada `submit_feedback`, menampilkan jabatan/unit & jam layanan sales di WA Picker, serta menambahkan alias `--gold: var(--champagne-gold); --ink: var(--charcoal);` di `:root` `guest.css` tanpa mengubah warna/layout tamu (`FR-P2-01`). |
| **BUG-14 (P2)** | `admin/index.html`:80, 107, 1237, 1356 & `SHEETS_SETUP.md` | Hint sandi `946217` masih tampil di HTML login; dropdown gerai masih statis 4 opsi; tren 30 hari terpotong di awal bulan; skema kolom di `SHEETS_SETUP.md` berbeda dari `Code.gs`. | Menghapus hint sandi lama, mengisi dropdown gerai secara dinamis via `populateOutletDropdowns()`, membaca tab bulan lalu di `_handleGetEventsData()`, dan menyelaraskan `docs/SHEETS_SETUP.md` (`FR-P2-02`, `FR-P2-03`). |

## 3. Spesifikasi Standar "Anti-Slop" pada Dashboard Admin (`FR-ADM-01` s/d `FR-ADM-05`)

| Kode Standar | Aspek Desain | Implementasi pada Portal Admin (`/admin/`) |
| :--- | :--- | :--- |
| **FR-ADM-01** | **Sistem Ikonografi SVG Monoline** | Menghapus seluruh 40+ emoji dekoratif dari sidebar, kartu KPI, judul seksi, dan tombol tabel di `/admin/`, digantikan dengan ikon vektor SVG monoline (`stroke-width: 1.8`, `BSAdmin.icon()`). |
| **FR-ADM-02** | **Copywriting Eksekutif Bersih** | Menghapus seluruh kode tiket internal PRD dari antarmuka pengguna (`(ANA-10)`, `(CNT-09)`, `(GUE-14)`, `(AF-03)`, `(PRD 6.1)`, `(REV-02)`) dan merapikan sub-judul kartu yang repetitif. |
| **FR-ADM-03** | **Disiplin Palet Emerald & Gold** | Mengganti kotak ikon KPI warna-warni pelangi dan warna grafik `Chart.js` (`#2563EB` biru & `#16A34A` hijau terang) dengan palet resmi Deep Emerald (`#1a3c2a`) dan Champagne Gold (`#b08f51`). |
| **FR-ADM-04** | **Tipografi Tabular & Gerak Presisi** | Menerapkan `font-variant-numeric: tabular-nums` pada seluruh angka KPI, waktu, dan tabel; menghapus motif polkadot latar login; serta mengganti animasi pegas modal dengan transisi `150ms ease-out`. |
| **FR-ADM-05** | **Pembersihan Markup Mock Statis** | Menghapus 88 baris kartu HTML *mock* statis beserta tombol mati (`Ganti Foto`) di `#adm-outlets-grid` (`admin/index.html`) sehingga kontainer dirender murni secara dinamis dari `BSAdmin.state.outlets`. |

## 4. Spesifikasi Fitur CMS Pengelolaan Penuh Isi Tampilan Halaman Tamu (`FR-CMS-01` s/d `FR-CMS-08`)

| Kode Modul | Zona Halaman Tamu | Cakupan Field yang Dikelola dari Portal Admin (`/admin/` -> Tab CMS Isi Halaman Tamu) |
| :--- | :--- | :--- |
| **FR-CMS-01** | **Skema `guest_content` & Allowlist** | Objek `guest_content` pada `BSConfig.DEFAULTS` (`assets/js/config.js`), allowlist publik `_handleGetConfig()` (`backend/Code.gs`), dan penyimpanan `_handleSaveAllAdminData()` dengan fallback otomatis. |
| **FR-CMS-02** | **Zona 1 — Identitas, Loading & Hero** | Nama Resmi Hotel, Nomor Telepon, Alamat Lengkap, Deskripsi Meta, URL Logo Header/Footer, Teks & Sub-teks *Loading Screen*, Gambar Latar Hero (`hero_bg_url`), Judul & Sub-judul Hero, 5 Template Sapaan Kontekstual (`general`, `staff`, `sales`, `outlet`, `nfc`), Label 2 Tombol CTA Hero, & Teks *Scroll Hint*. |
| **FR-CMS-03** | **Zona 2 — Google Review & Direct Feedback** | URL Utama Google Review, Judul & Sub-judul Seksi Review, Judul Kartu Review, Teks Prompt Review, Label Tombol Google Review, serta seluruh label & placeholder formulir *Direct Feedback* (Tombol Buka, Pertanyaan Rating, Placeholder Pesan/Nama/WA, Tombol Kirim, & Pesan Terima Kasih). |
| **FR-CMS-04** | **Zona 3 — Seksi Gerai F&B & Promosi** | Judul & Sub-judul Seksi Gerai (`#bs-outlets-heading`), Label Tombol CTA Default Kartu Gerai, Template Pesan Reservasi WA Gerai (`{outlet_name}`), Judul & Sub-judul Seksi Promosi (`#bs-promos-heading`), Label Tombol CTA Default Promosi, & Template Pesan WA Promosi (`{promo_name}`, `{outlet_name}`). |
| **FR-CMS-05** | **Zona 4 — WA Concierge & Sales Picker** | Teks Badge Status (`Concierge Online`), Judul & Sub-judul Kartu WA Concierge, Label Tombol Chat WA, serta seluruh teks Modal *WA Sales Picker* (`#bs-wa-picker`: Badge Atas, Judul Modal, Sub-judul, Label Tombol Baris Sales, Teks Fallback Kosong, & Label Tombol Reservasi Fallback) plus Jam Layanan & Template Pesan per Sales di modal Sumber. |
| **FR-CMS-06** | **Zona 5 — Sosial, Final CTA, Mobile Bar & Footer** | Judul & Sub-judul Seksi Media Sosial, URL & Label Tombol untuk Instagram, Facebook, TikTok, YouTube, dan Website Resmi; Judul, Sub-judul, & 2 Label Tombol Seksi *Final CTA*; 2 Label Tombol *Floating Mobile Action Bar*; serta Label Link Kebijakan Privasi, Label & Toggle Visibilitas Link *Management Portal*, Teks Hak Cipta, dan Tag Versi Footer. |
| **FR-CMS-07** | **Zona 6 — Modal Kebijakan Privasi** | Teks Badge Standar Privasi, Judul Modal Privasi (`#bs-privacy-title`), Paragraf Pembuka Cetak Tebal, Paragraf Pengantar Kedua, Judul & Daftar Poin Blok 1 (*Data yang Tidak Pernah Dikumpulkan*), Blok 2 (*Data Teknis & Pseudonim*), Blok 3 (*Tujuan & Retensi Data*), Kalimat Penutup, serta Label Tombol Konfirmasi (`I Understand`). |
| **FR-CMS-08** | **Workspace CMS, 8 Toggle Visibilitas & Live Preview** | Navigasi filter per zona (Zona 1–6) di tab *CMS Isi Halaman Tamu*, 8 toggle visibilitas di tab *Promosi & Visibilitas* (`show_review`, `show_direct_feedback`, `show_outlets`, `show_promotions`, `show_wa`, `show_social`, `show_final_cta`, `show_mobile_bar`), tombol *Kembalikan Teks Standar*, dan sinkronisasi instan ke modal *Pratinjau Draft Tamu* (`?preview=1`). |

## 5. Spesifikasi Penyimpanan Otomatis (Auto-Save CRUD ke Backend — `FR-CRUD-AUTO`)

Seluruh tombol dan interaksi CRUD di Portal Admin (`/admin/`) kini langsung melakukan sinkronisasi otomatis ke backend Google Sheets tanpa mengharuskan pengguna menekan tombol "Simpan & Sinkronkan ke Cloud" secara terpisah:

| Modul & Tab Admin | Tombol / Aksi CRUD | Mekanisme Auto-Save ke Backend (`Code.gs`) |
| :--- | :--- | :--- |
| **Staf, Sales & Titik NFC** (`#tab-sources` & `#tab-sales-wa`) | Tambah Staf/Sales/NFC/Gerai Baru (`#adm-source-form`), Edit Sumber, Rotasi Kode URL (`adminRotateSource`), Aktifkan/Nonaktifkan (`adminDeactivate`), Hapus Sumber (`adminDeleteSource`), & Impor CSV Sumber | Memanggil `BSAdmin.sources.autoSyncSources()` (`BSStaffManager.syncToCloud()`) secara otomatis setiap kali aksi selesai, memperbarui indikator `#adm-sync-indicator` menjadi `Menyimpan…` lalu `Tersimpan`. |
| **Programmer Kartu NFC** (`#tab-nfc`) | Tandai Kartu Sudah Diprogram (`#adm-nfc-mark-programmed`) & Tulis Web NFC (`#adm-nfc-write-btn`) | Memperbarui `kartu_diprogram = true` dan langsung memanggil `BSAdmin.sources.autoSyncSources()` ke lembar `Sources`. |
| **Manajemen Gerai F&B** (`#tab-outlets`) | Tambah/Edit Gerai (`#adm-outlet-form`), Aktifkan/Nonaktifkan Cepat (`adminToggleOutlet`), & Hapus Gerai (`adminDeleteOutlet`) | Langsung memanggil `BSApi.saveAllAdminData({ config: state.configData })` pada setiap mutasi. |
| **Promosi & 8 Toggle Visibilitas** (`#tab-promos`) | Tambah/Edit Promo (`#adm-promo-form`), Aktifkan/Nonaktifkan Cepat (`adminTogglePromo`), Hapus Promo (`adminDeletePromo`), & Centang/Hapus Centang 8 Toggle Seksi (`#adm-sec-*`) | Setiap perubahan 8 checkbox visibilitas seksi maupun status promosi otomatis memanggil `BSApi.saveAllAdminData({ config: state.configData })`. |
| **CMS Isi Halaman Tamu** (`#tab-appearance`) | Pilih Mode Bahasa (`#adm-cms-lang-mode`), Terapkan Preset Bahasa Indonesia/Inggris, Toggle Link Admin Footer (`#adm-cms-ftr-show-admin`), Tombol Simpan per Zona (`.adm-cms-save-zone-btn`), Reset Default (`#adm-cms-reset-btn`), & Simpan Seluruh Konten | Setiap tombol aksi, preset bahasa, toggle, dan tombol simpan per zona langsung memanggil `saveAppearance()` ke lembar `Config`. |
| **Audit Anti-Fraud & Perangkat Staf** (`#tab-antifraud`) | Tandai HP Staf dari Tabel Fraud (`adminMarkDevice`), Daftarkan Perangkat (`#adm-staff-device-form`), & Hapus Perangkat (`adminRemoveStaffDevice`) | Langsung memanggil `BSApi.saveAllAdminData({ staff_devices: state.staffDevices })`. |
| **Konfigurasi, Alert & Backup** (`#tab-config`) | Simpan Threshold Fraud (`#adm-ft-save-btn`), Simpan Notifikasi Rating Rendah (`#adm-cfg-alert-save-btn`), & Pulihkan Cadangan JSON (`#adm-cfg-backup-import-btn`) | Langsung memanggil `BSApi.saveAllAdminData(...)` untuk menyimpan konfigurasi ke Google Sheets dan menginvalidasi cache publik. |
| **Manajemen Akun & RBAC** (`#tab-account`) | Ganti Sandi (`#adm-acc-pw-form`), Tambah/Edit Pengguna RBAC (`#adm-user-form`), Aktifkan/Nonaktifkan Akun (`adminToggleUserActive`), & Hapus Akun (`adminDeleteUser`) | Langsung memanggil endpoint `change_password`, `save_user`, atau `delete_user` di `Code.gs` dan memperbarui lembar `Users`. |
| **Feedback Langsung Tamu** (`#tab-feedback`) | Tandai Sudah Ditangani / Belum Dibaca (`adminMarkFeedback`) | Langsung memanggil `BSApi.markFeedbackHandled(id, newStatus)` ke lembar `Feedback`. |

## 6. Spesifikasi Peningkatan Performa, Keamanan & Fitur Tambahan Fase 4 (`FR-V64-01` s/d `FR-V64-07`)

| Kode Fitur | Nama Fitur & Peningkatan | Rincian Implementasi Teknis |
| :--- | :--- | :--- |
| **FR-V64-01** | **Server-Side Caching `get_config` (`CacheService`)** | `_handleGetConfig()` di `backend/Code.gs` menyimpan respons JSON publik di `CacheService.getScriptCache()` (`bs_public_config_v64`, TTL 300 detik) sehingga waktu muat halaman tamu turun drastis (<100 ms) dan kuota baca Google Sheets hemat >90%. Cache otomatis dihapus via `_invalidatePublicConfigCache()` setiap kali admin menyimpan perubahan. |
| **FR-V64-02** | **Notifikasi Instan Feedback Rating Rendah (`<= 3` Bintang)** | Saat tamu mengirim *Direct Feedback* dengan `rating <= 3`, `_sendLowRatingAlert()` di `Code.gs` otomatis mengirim email peringatan instan melalui `GmailApp.sendEmail` ke `alert_email` (atau Script Property `EMAIL_MANAJEMEN`) serta meneruskan payload JSON ke `alert_webhook_url` jika dikonfigurasi di `#tab-config`. |
| **FR-V64-03** | **Panel UI Manajemen Pengguna RBAC Multi-Admin** | Menambahkan antarmuka CRUD penuh di `#tab-account` (khusus `super_admin`) yang terhubung ke endpoint baru `list_users`, `save_user`, dan `delete_user` di `Code.gs` untuk menambah pengguna (`super_admin`, `manager`, `content_editor`, `analyst_readonly`), mengubah peran, mereset sandi, atau menonaktifkan/menghapus akun tanpa perlu membuka Apps Script Editor. |
| **FR-V64-04** | **Endpoint `logout` Server-Side & Pencabutan Token** | Menambahkan aksi `logout` pada `Code.gs` (`_handleLogout`) yang menghapus token sesi dari `CacheService` (`sess_<token>`) dan mencatat aksi `LOGOUT` di lembar `AuditLog`, dipanggil otomatis oleh `BSAuth.logout()`. |
| **FR-V64-05** | **Impor/Ekspor CSV Sumber & Backup/Restore JSON 1-Klik** | Menambahkan tombol *Impor CSV* & *Ekspor CSV* pada `#tab-sources` (dengan auto-sync ke backend seusai impor) serta kartu *Unduh Cadangan Lengkap (.json)* & *Pulihkan dari Berkas JSON* pada `#tab-config`. |
| **FR-V64-06** | **Mode Dwibahasa Otomatis (ID / EN) & Preset 1-Klik** | Menambahkan `BSConfig.PRESET_ID` (kamus lengkap Bahasa Indonesia) dan `language_mode: "auto" | "id" | "en"`. Halaman tamu (`guest/app.js`) mendeteksi `?lang=id|en` atau bahasa peramban secara otomatis tanpa mengubah tone warna maupun layout halaman tamu. Admin juga dapat menerapkan *Preset Bahasa Indonesia* atau *Preset English* 1-klik di `#tab-appearance`. |
| **FR-V64-07** | **Tabel Historis `MonthlyAggregates` & Filter Tanggal Kustom** | `_handleGetAdminData()` dan `_handleGetEventsData()` kini membaca lembar `MonthlyAggregates` via `_readMonthlyAggregates(ss)` dan menampilkannya pada tabel *Ringkasan Historis Bulanan* di `#tab-dashboard`, dilengkapi filter rentang tanggal kustom (*Dari – Sampai*). |

## 7. Spesifikasi Perbaikan Header Mobile & Peningkatan Operasional Fase 5 (`BUG-15`, `FR-V65-01` s/d `FR-V65-05`)

### 7.1. Analisis Akar Masalah & Perbaikan Layout Header Dashboard di HP (`BUG-15` / `FR-V65-01`)

| Komponen Header / Dashboard | Akar Masalah pada Layar HP (`<= 768px` & `<= 480px`) | Solusi Arsitektur Responsif (`assets/css/admin.css` & `admin/index.html`) |
| :--- | :--- | :--- |
| **Topbar Utama Portal (`.adm-topbar`)** | Memiliki tinggi kaku `height: var(--topbar-h)` (`66px`) dan `flex-wrap: nowrap`. Saat dibuka di layar HP (360px–414px), grup judul kiri (`.adm-topbar-left`) dan 4 kontrol aksi kanan (`.adm-topbar-actions`: indikator sync, dropdown bulan, tombol *Perbarui*, dan *Ekspor CSV*) bertabrakan secara horizontal serta meluber keluar dari kotak 66px menimpa `.adm-health-bar`. | Mengubah `.adm-topbar` pada `<= 768px` menjadi `height: auto; min-height: 56px; padding: 10px 14px; flex-direction: column; align-items: stretch; gap: 8px;`. Baris atas menampilkan tombol hamburger `38x38px` dan judul satu baris (`text-overflow: ellipsis`), sedangkan baris bawah menampilkan `.adm-topbar-actions` dalam CSS Grid proporsional (`auto 1fr auto auto` pada tablet/HP lebar dan `grid-template-columns: 1fr 1fr` 2x2 rapi pada layar `<= 480px`). |
| **Bar Sinyal Health (`.adm-health-bar`)** | Menggunakan `padding: 7px 28px; gap: 16px; flex-wrap: wrap;` sehingga 5 item sinyal kesehatan sistem terpecah menjadi 3–4 baris tidak rata di layar HP. | Mengubah `.adm-health-bar` pada `<= 768px` menjadi CSS Grid 2 kolom (`grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 8px 14px; gap: 6px 10px;`) dengan badge status utama merentang penuh di baris pertama (`grid-column: 1 / -1`). |
| **Header Filter & Rentang Tanggal Dashboard (`.adm-fav-filter-card`)** | Menggunakan inline `display: flex` dengan dua `<input type="date" style="width:auto">` dan 7 tombol aksi dalam satu kontainer, sehingga meluber secara horizontal di layar ponsel sempit. | Mengganti inline style dengan class semantik `.adm-dash-toolbar-wrap`, `.adm-dash-preset-btns` (grid 2 kolom di HP), `.adm-dash-date-inputs` (`grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)`), dan `.adm-dash-date-actions` (grid 3 kolom sejajar: *Terapkan*, *Reset*, *Simpan Filter*). |
| **Header Kartu (`.adm-card-header`) & Sticky CMS Toolbar (`.adm-cms-toolbar`)** | `.adm-cms-toolbar` memakai `position: sticky; top: 66px;` yang bertumpukan dengan `.adm-topbar` saat tinggi topbar bertambah di HP dan menutupi setengah layar ponsel. | Mengatur `.adm-card-header` menjadi `flex-direction: column; align-items: stretch;` pada `<= 768px`, membuat `.adm-cms-toolbar` menjadi `position: static;` di HP, serta menurunkan `.adm-metrics-grid` menjadi 2 kolom ringkas (`<= 768px`) dan 1 kolom (`<= 480px`). |
| **Drawer Navigasi Sidebar Mobile (`#adm-sidebar`)** | Saat menu hamburger dibuka di HP, tidak ada lapisan latar redup (*backdrop*) untuk menutup menu ketika area luar diketuk, dan halaman belakang masih ikut tergulir. | Menambahkan elemen `#adm-sidebar-backdrop` (`.adm-sidebar-backdrop`) serta pengunci gulir `body.adm-mobile-nav-open` di `admin-init.js` agar mengetuk area luar otomatis menutup sidebar. |

### 7.2. Fitur Tambahan Operasional Fase 5 (`FR-V65-02` s/d `FR-V65-05`)

| Kode Fitur | Nama Fitur & Peningkatan | Rincian Implementasi Teknis |
| :--- | :--- | :--- |
| **FR-V65-02** | **Pencarian Cepat & Filter Tipe Sumber di `#tab-sources`** | Menambahkan bilah pencarian instan `#adm-sources-search` (mencari nama, kode URL, unit/gerai, jabatan, atau nomor WA secara *real-time*), dropdown `#adm-sources-type-filter` (*Semua / Staf / Sales / NFC / Gerai*), dan penghitung `#adm-sources-count-info` di `admin/index.html` & `assets/js/admin/admin-sources.js`. |
| **FR-V65-03** | **Ekspor CSV Masukan Tamu (`#tab-feedback`)** | Menambahkan tombol **Ekspor CSV** (`#adm-feedback-export-btn`) di header `#tab-feedback` (`assets/js/admin/admin-feedback.js`) untuk mengunduh rekapitulasi masukan dan keluhan tamu beserta status penanganannya. |
| **FR-V65-04** | **Pengiriman Ulang Manual Antrean Offline (*DLQ Manual Flush*)** | Apabila terdapat event di `bs_dead_letter_queue` (`Antrean Tertunda > 0`), indikator `#adm-health-dlq-count` di bar health kini dapat diklik langsung untuk memicu `BSAdmin.flushDeadLetterQueue()` (`assets/js/admin/admin-core.js`) ke server. |
| **FR-V65-05** | **Rekomendasi Ekspansi Masa Depan (Opsional Fase Berikutnya)** | 1) **PWA Offline Caching (`manifest.json` & Service Worker)** untuk menyimpan aset gambar gerai/logo di ponsel tamu; 2) **Integrasi Webhook WhatsApp Business API Resmi** pada `alert_webhook_url` untuk mengirim notifikasi keluhan bintang `<= 3` langsung ke grup WA Duty Manager; 3) **Multi-Property Support** jika manajemen ingin memperluas platform ke properti hotel/resor jaringan lainnya. |

## 8. Spesifikasi Manajemen Role Dinamis & Pengaturan Visibilitas Menu Dashboard (`FR-V66-ROLE-MENU`)

Menjawab kebutuhan agar **setiap role yang masuk ke dashboard hanya menampilkan menu sidebar yang sesuai (serta mendukung pembuatan role baru dengan daftar menu kustom)**, sistem dilengkapi modul **Manajemen Role & Pengaturan Menu Dashboard per Role (`#adm-role-mgmt-card`)** di tab **Akun & Keamanan (`#tab-account`)**:

### 8.1. Matriks Default Role & Menu Sidebar yang Ditampilkan Saat Login

| Kode Role (`role_id`) | Nama Tampilan Role | Mode Akses Data | Menu Pertama Saat Login (`default_tab`) | Menu Sidebar yang Tampil (`allowed_tabs`) | Menu yang Disembunyikan Otomatis (`display: none`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`super_admin`** | Super Administrator (Akses Penuh) | CRUD Penuh | `dashboard` | Seluruh 13 Menu (`dashboard`, `sources`, `antifraud`, `feedback`, `outlets`, `sales-wa`, `nfc`, `bulk-qr`, `promos`, `appearance`, `audit`, `config`, `account`) | Tidak ada (akses penuh) |
| **`manager`** | Manager Operasional | CRUD Aktif | `dashboard` | 12 Menu (`dashboard`, `sources`, `antifraud`, `feedback`, `outlets`, `sales-wa`, `nfc`, `bulk-qr`, `promos`, `appearance`, `audit`, `account`) | `config` (Konfigurasi Backend & Manajemen User/Role) |
| **`content_editor`** | Editor Konten & Halaman Tamu | CRUD Aktif | `appearance` | 5 Menu (`outlets`, `sales-wa`, `promos`, `appearance`, `account`) | `dashboard`, `sources`, `antifraud`, `feedback`, `nfc`, `bulk-qr`, `audit`, `config` |
| **`analyst_readonly`** | Analis Data (Hanya Baca) | Hanya Baca (*Read-Only*) | `dashboard` | 9 Menu (`dashboard`, `sources`, `antifraud`, `outlets`, `sales-wa`, `bulk-qr`, `promos`, `audit`, `account`) | `feedback` (PII Tamu), `nfc`, `appearance`, `config` |
| **Role Kustom Baru** *(mis. `sales_spv`, `duty_manager`, `marcomm`, `front_office`)* | Dikonfigurasi bebas oleh `super_admin` | Dapat dipilih: **CRUD Aktif** atau **Hanya Baca** | Dapat dipilih dari 13 menu | Dikonfigurasi bebas melalui **13 Checkbox Menu Sidebar** di `#adm-role-form` | Seluruh menu yang tidak dicentang otomatis disembunyikan dari sidebar & diblokir di `switchTab()` serta `Code.gs` |

### 8.2. Alur Kerja Penambahan Role & Pengaturan Menu (`#tab-account`)

1. **Tambah Role Baru atau Edit Role yang Ada (`#adm-role-form`)**:
   - Super Administrator membuka menu **Akun & Keamanan** (`#tab-account`) -> kartu **Manajemen Role & Pengaturan Menu Dashboard per Role**.
   - Isi **Kode Role / ID** (contoh: `sales_spv` atau klik tombol **Atur Menu** pada role `manager` / `content_editor` / `analyst_readonly`), **Nama Tampilan Role**, **Mode Hak Akses Data** (*CRUD Aktif* vs *Hanya Baca*), dan **Menu Pertama yang Terbuka Saat Login**.
   - Centang daftar **13 Menu Sidebar** (`input[name="adm-role-tab"]`) yang ingin ditampilkan saat pengguna dengan role tersebut masuk ke dashboard.
   - Klik **Simpan Role & Menu ke Server** (`#adm-role-submit-btn`): konfigurasi `role_permissions` langsung tersimpan otomatis ke lembar `Config` di Google Sheets (`FR-CRUD-AUTO`) dan pilihan role tersebut langsung muncul di dropdown **Peran Hak Akses (Role)** (`#adm-user-role`) pada form pembuatan akun pengguna di bawahnya.
2. **Penegakan Visibilitas Sidebar & Keamanan Backend (`admin-core.js` & `backend/Code.gs`)**:
   - Di sisi frontend (`BSAdmin.applyRoleRestrictions()`), setiap item menu `.adm-nav-item` yang tidak termasuk dalam `allowed_tabs` role pengguna yang sedang login langsung disembunyikan (`style.display = "none"`), termasuk menyembunyikan judul grup kategori (`.adm-nav-group-title`) jika seluruh menu di dalam grup tersebut tersembunyi.
   - Saat login berhasil (`BSAdmin.showPortal()`), pengguna otomatis diarahkan ke `default_tab` milik rolenya.
   - Di sisi server (`backend/Code.gs` -> `_getRoleDef(role)` & `_roleHasTab(role, tabName)`), backend membaca `role_permissions` dari lembar `Config` dan menolak akses baca/tulis apabila token sesi pengguna berasal dari role yang tidak memiliki izin atas modul tersebut.

---

## 9. Audit Independen v6.7 — Temuan Residual Pasca v6.6 (`BUG-16` s/d `BUG-38`, `FR-V67-01` s/d `FR-V67-16`)

| Atribut Dokumen | Rincian Spesifikasi |
| :--- | :--- |
| **Tanggal Audit** | 23 Oktober 2026 |
| **Metode** | Audit baris-per-baris 4 modul paralel (Guest, Admin, Backend, Gap PRD) + verifikasi langsung ke produksi (`https://rizqiwidi.github.io/hotelbumi/`, endpoint GAS `?action=get_config` → `backend_version: v6.6.0-phase6`) |
| **Basis Kode** | Commit `5068a9e` (v6.5/v6.6) — 17.983 baris |
| **Status** | **9 blocker produksi**, 14 bug P1, ~12 fitur belum ada |
| **Kesimpulan Arsitektur** | Sehat. Vanilla tanpa build, anti-fraud 8 aturan lengkap, RBAC + audit trail ada. Masalah utama ada pada **wiring kontrak UI↔backend** (nama field, nama aksi, lokasi key), bukan pada konsep. |

### 9.1. Blocker Produksi P0 (`BUG-16` s/d `BUG-24`)

| ID | Berkas & Baris | Akar Masalah | Dampak Terverifikasi | Solusi (`FR-V67-xx`) |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-16** | `.github/workflows/static.yml`:40 | `path: '.'` mengunggah seluruh repo | **Terverifikasi live**: `curl /backend/Code.gs` → HTTP 200. Skema sheet, logika auth, threshold fraud, PRD publik. `BUG-10`/`FR-P1-03` belum dikerjakan. | `FR-V67-01`: build `_site/` berisi hanya `index.html`, `admin/`, `assets/` sebelum `upload-pages-artifact`; tambah `404.html`; pindahkan PRD & notes ke folder `internal/` yang dikecualikan dari Pages. |
| **BUG-17** | `admin-core.js`:444-459 vs `Code.gs`:736-803 | UI kirim `action:'track'` (aksi tidak ada di router); payload terbungkus `{id,gasUrl,payload,retries}`; HTTP 200 dianggap sukses lalu antrean dihapus | Event tamu hilang permanen saat flush DLQ; badge `Antrean Tertunda` menyesatkan. `FR-V65-04` tidak berfungsi. | `FR-V67-02`: ubah aksi UI ke `log_event` yang sudah ada di router + unwrap `ev.payload` + kirim ke `ev.gasUrl`; anggap sukses hanya bila `resp.ok === true`. |
| **BUG-18** | `Code.gs`:296, `:441-465`, `:1226-1270` vs `admin-fraud-ops.js`:781 | Sheet `Users` 7 kolom tanpa `active`; `_findUser` & `_handleLogin` tidak cek status; UI kirim `active` yang diabaikan backend | Tombol **Nonaktifkan** (`admin-fraud-ops.js`:774-789) melapor sukses tapi akun tetap bisa login 6 jam. Tidak ada cara menonaktifkan selain hapus permanen. | `FR-V67-03`: perluas skema `Users` → 8 kolom (`active`), migrasi `getLastColumn() < 8`; `_findUser` baca kolom 8; `_handleLogin` tolak `active === false` dengan pesan generik; `_handleListUsers` kirim `active`. |
| **BUG-19** | `Code.gs`:1074, `:1093` vs `admin-fraud-ops.js`:723, `:782`, `:849` | Server kirim `must_change`, UI baca `must_change_password`; UI kirim `must_change_password`, server baca `must_change` | Reset sandi paksa tak pernah aktif; badge "Wajib Ganti Sandi" tak pernah tampil; setiap simpan edit menghapus flag lama. `FR-V64-03` PARTIAL. | `FR-V67-04`: satukan nama field ke `must_change` di ketiga titik; tambah fallback baca `must_change_password` selama satu rilis. |
| **BUG-20** | `config.js`:395, `tracking.js`:251 | `sessionStorage.getItem` tanpa `try` | Browser blokir storage (mode privat/ITP) → exception sebelum `onSuccess` → `#bs-loading` (`index.html`:41) tidak pernah hilang, halaman **kosong permanen**. | `FR-V67-05`: bungkus seluruh akses storage dalam helper `_safeGet`/`_safeSet` dengan fallback memori. |
| **BUG-21** | `admin-fraud-ops.js`:287 vs `Code.gs`:980-981 | UI simpan `alert_email`/`alert_webhook_url` sebagai key `Config` terpisah; backend baca dari dalam objek `general` | Notifikasi keluhan rating ≤3 **tidak pernah terkirim** walau admin sudah mengisi. `FR-V64-02` gagal senyap. | `FR-V67-06`: UI tulis ke `config.general.alert_email`; backend tambah fallback baca key top-level untuk data lama. |
| **BUG-22** | `index.html` & `admin/index.html` (0 hasil `Content-Security-Policy`) | Tanpa CSP; token sesi di `sessionStorage` (`auth.js`:21-38) | Satu XSS = pengambilalihan penuh sesi `super_admin`. | `FR-V67-07`: `<meta http-equiv="Content-Security-Policy">` dengan allowlist eksplisit (`fonts.googleapis.com`, `fonts.gstatic.com`, `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `script.google.com`); pindahkan inline script `index.html`:413 ke berkas; kurangi 146 inline `style=` di `admin/index.html`. |
| **BUG-23** | `Code.gs`:1462-1500 | `get_admin_data` hanya menghapus `fraud_thresholds` untuk `content_editor`; tidak ada gate `_roleHasTab` | `analyst_readonly` tetap menerima `alert_email`, `alert_webhook_url`, `role_permissions`, dan seluruh `sources` nonaktif. Klaim PRD §8.2 butir 2 tidak terpenuhi. | `FR-V67-08`: gate per key — `sources` butuh `_roleHasTab(role,'sources')`, `staff_devices` butuh `antifraud`, `config` butuh `config`, `monthly_aggregates` butuh `dashboard`; hapus key terlarang, jangan hanya `fraud_thresholds`. |
| **BUG-24** | `Code.gs`:1540-1547 | `content_editor` bisa menulis `config.general` (`hotel_name`, `whatsapp`, `google_review_url`) & `alert_email` | Eskalasi wewenang: editor konten bisa mengubah nomor WA & URL review publik tanpa akses tab `config`. | `FR-V67-09`: allowlist key tulis per role; `general` hanya untuk `config`; audit `MUTATION_DENIED` pada penolakan. |

### 9.2. Bug & Kelemahan P1 (`BUG-25` s/d `BUG-38`)

| ID | Berkas & Baris | Temuan | Effort |
| :--- | :--- | :--- | :--- |
| **BUG-25** | `app.js`:84-94 | `?lang=id` rusak: `Object.assign({}, base, act)` menimpa preset ID dengan teks server yang satu bahasa. Klaim `FR-V64-06` palsu. | M |
| **BUG-26** | `config.js`:421 vs `:395` | `CONFIG_VERSION_KEY` ditulis tapi tak pernah dibandingkan; cache `sessionStorage` per-tab tak kedaluwarsa → tamu lihat konten lama sepanjang tab hidup. | M |
| **BUG-27** | `Triggers.gs`:590; `ASSUMPTIONS.md`:86 | Retensi data: fungsi ada, trigger belum dipasang, default `dryRun`. Klaim privasi 12/24 bulan tidak ditegakkan. | S |
| **BUG-28** | `Code.gs`:241-268 | Hash sandi 1000 iterasi SHA-256 berlabel `pbkdf2_sha256` — menyesatkan, lemah terhadap GPU. Perbandingan pakai `===` (bukan constant-time). | M |
| **BUG-29** | `Code.gs`:1300-1327, `:1089-1128` | `change_password` & reset via `save_user` tidak mencabut sesi lain; `breakGlassRecovery` (`:392-440`) juga tidak, padahal `SHEETS_SETUP.md`:102 menjanjikan. | S |
| **BUG-30** | `Code.gs`:1236-1244 | Rate limit login tanpa IP → DoS: 5 request/menit mengunci user mana pun. `_checkRateLimit` read-then-write, tidak atomik. | S |
| **BUG-31** | `Code.gs`:855, `:1380` | Rate limit feedback & log event memakai `device_id` dari klien → cukup ganti `device_id` untuk spam tak terbatas. | M |
| **BUG-32** | `Code.gs`:1439, `:158-173` | Kolom `ip` selalu ditulis string kosong di Events & AuditLog → audit trail kehilangan nilai forensik. | S |
| **BUG-33** | `Code.gs`:672-712 | `get_config` publik mengembalikan seluruh staf aktif + nama + jam layanan → enumerasi data personal tanpa auth. | S |
| **BUG-34** | `Code.gs`:806-808 | `err.toString()` dikirim ke klien → bocor detail internal/quota/stack. | S |
| **BUG-35** | `admin-core.js`:126-136, `:668` | `updateSyncStatus('saving')` tidak set `hasUnsaved`; refresh menimpa edit lokal. Satu flag global untuk semua modul. | M |
| **BUG-36** | `admin-content.js`:572-578 | Auto-save per checkbox + tombol manual → double POST tanpa debounce, urutan respons acak. | M |
| **BUG-37** | `app.js`:429-442 vs `Code.gs`:634-635 | Filter promo ganda: string compare di backend + `Date` di klien → promo tampil/hilang tak konsisten antar zona waktu. | S |
| **BUG-38** | `index.html`:298, `config.js`:90, `Code.gs`:708, `tracking.js`:2, `retry-queue.js`:2 | Drift versi: v6.3 / v6.4 / v6.6.0-phase6 / v6.3 / v5.0 → salah lapor saat troubleshooting. | S |

### 9.3. Desain & Aksesibilitas (`FR-V67-10` s/d `FR-V67-12`)

| Kode | Area | Temuan | Perbaikan |
| :--- | :--- | :--- | :--- |
| **FR-V67-10** | Kontras halaman tamu (WCAG AA) | `.bs-outlet-type` emas `#c9a96e` di putih ≈2.2:1 (`guest.css`:331); `#888` jam & periode promo ≈3.5:1 (`:336`, `:394`); scroll-hint ≈3:1 (`:230`); footer `rgba(255,255,255,.55)` 0.82rem ≈4.4:1 (`:472`, `:475`) | Gelapkan ke `#8a6d3b` untuk teks emas di atas putih (≈4.6:1); `#666` untuk metadata; naikkan opasitas footer ke `.72`. **Tidak mengubah layout** — hanya nilai warna. |
| **FR-V67-11** | Tap target & safe-area | `.bs-star` padding 4px (`guest.css`:201), `.bs-modal-close` 36×36 (`:557`); mobile bar `bottom:16px` tanpa `env(safe-area-inset-bottom)` (`:509`); modal tanpa safe-area (`:544-553`) | Semua target ≥44×44px; `bottom: calc(16px + env(safe-area-inset-bottom))`; tambah `padding-bottom` modal. |
| **FR-V67-12** | Semantik & modal | `<html lang="en">` tak pernah diubah saat bahasa `id`; `role="radiogroup"` tanpa navigasi panah (`app.js`:749-758); `role="banner"` di `<section>` dalam `<main>` (`index.html`:52); modal tak lock scroll latar & tak `inert` (`app.js`:836-899); `role="list"` tanpa `listitem` (`index.html`:184,197,236) | `document.documentElement.lang = lang`; tambah handler ArrowLeft/Right/Space; hapus `role="banner"`; `body.style.overflow='hidden'` + `inert` saat modal buka; hapus `role="list"` redundan. |

**Admin portal:** tanpa dark mode (warna hardcoded `admin.css`:746, `:1274`); `.adm-table` tanpa `min-width` (`:738-743`) → squeeze di tablet; modal hanya responsif ≤480px (`:1495-1499`); login tanpa "lupa kata sandi"; form `novalidate` tanpa error inline; 146 inline `style=` di `admin/index.html`.

### 9.4. Fitur Belum Ada (`FR-V67-13` s/d `FR-V67-16`)

| Kode | Modul | Fitur | Nilai Bisnis | Effort |
| :--- | :--- | :--- | :--- | :--- |
| **FR-V67-13** | Halaman tamu | Toggle bahasa ID/EN di UI | `?lang=` tak terlihat tamu | M |
| **FR-V67-13** | Halaman tamu | Tautan Google Maps + `tel:` | Alamat & telepon ada di `config.js`:127 tapi tak dirender (`app.js`:669-673) | S |
| **FR-V67-13** | Halaman tamu | Galeri properti | Aset hanya 4 foto outlet | M |
| **FR-V67-13** | Halaman tamu | Info fasilitas (check-in/out, Wi-Fi, sarapan) | Standar bintang lima | M |
| **FR-V67-13** | Halaman tamu | Consent analytics sebelum `visit` terkirim (`tracking.js`:277-282) | Kepatuhan privasi; modal kini informasi, bukan persetujuan | M |
| **FR-V67-13** | Halaman tamu | Indikator offline + banner fallback; `<noscript>`; `og:image` | Fallback DEFAULTS kini tampil seolah normal; spinner abadi tanpa JS; preview share kosong | S |
| **FR-V67-14** | Admin | Daftar & cabut sesi aktif | Butuh endpoint baru + index `sess_*` | M |
| **FR-V67-14** | Admin | Reset sandi mandiri (lupa sandi) | Kini harus lewat `super_admin` | M |
| **FR-V67-14** | Admin | Upload gambar (bukan input path teks) | `admin/index.html`:2060, 2153 | M |
| **FR-V67-14** | Admin | Backup/restore penuh | Kini hanya `Config` (`admin-fraud-ops.js`:311-329) | M |
| **FR-V67-14** | Admin | Paginasi + ekspor audit log | `admin-audit.js`:45 limit 150 | S |
| **FR-V67-14** | Admin | Date picker periode promo | Kini teks bebas (`admin-content.js`:218) | S |
| **FR-V67-14** | Admin | Bulk edit sumber; ekspor XLSX/PDF | Kini hanya impor CSV; hanya CSV | M |
| **FR-V67-15** | Backend | Endpoint `track` resmi idempoten untuk DLQ; rate limit berbasis IP + Turnstile untuk `log_event`/`submit_feedback`; allowlist key `Config` | Prasyarat `BUG-17`, `BUG-31` | M |
| **FR-V67-16** | Infra | PWA (`manifest.json` + Service Worker) — `FR-V65-05` butir 1 | Opsional | M |

### 9.5. Urutan Eksekusi yang Disarankan

| Gelombang | Item | Prasyarat | Estimasi |
| :--- | :--- | :--- | :--- |
| **W1 — Blocker** | `BUG-16` (CI), `BUG-20` (storage), `BUG-22` (CSP) | — | 1–2 hari |
| **W2 — Kontrak data** | `BUG-18`, `BUG-19`, `BUG-21`, `BUG-17`, `BUG-23`, `BUG-24` | W1 | 3–4 hari |
| **W3 — P1 backend** | `BUG-27`, `BUG-28`, `BUG-29`, `BUG-30`, `BUG-31`, `BUG-32`, `BUG-33`, `BUG-34` | W2 | 1 minggu |
| **W4 — Guest & a11y** | `BUG-25`, `BUG-26`, `BUG-37`, `FR-V67-10/11/12` | W2 | 1 minggu |
| **W5 — Fitur** | `FR-V67-13` (guest), `FR-V67-14` (admin) | W4 | 2–3 minggu |
| **W6 — Opsional** | `FR-V67-15`, `FR-V67-16` | W5 | sesuai kebutuhan |

**Catatan koreksi audit:** temuan awal "#bs-staff-badge hilang" (`app.js`:240-271) **bukan bug**. Elemen dihapus sengaja pada commit `41bc7bc` ("Hapus badge Served-by di hero"). Tindakan: hapus kode mati `app.js`:240-271 agar tidak menyesatkan audit berikutnya.

---

## 10. Status Eksekusi (Diperbarui 23 Oktober 2026)

| Gelombang | Item | Status |
| :--- | :--- |
| **W1 — Blocker** | `BUG-16` (CI `_site/`), `BUG-20` (storage aman), `BUG-22` (CSP) | ✅ Selesai |
| **W2 — Kontrak data** | `BUG-17`, `BUG-18`, `BUG-19`, `BUG-21`, `BUG-23`, `BUG-24` | ✅ Selesai |
| **W3 — P1 backend** | `BUG-27` s/d `BUG-34` | ✅ Selesai |
| **W4 — Guest & a11y** | `BUG-25`, `BUG-26`, `BUG-37`, `BUG-38`, `FR-V67-10/11/12` | ✅ Selesai |
| **W5 — Fitur guest** | `FR-V67-13` (toggle bahasa, Maps, `tel:`, `<noscript>`, `og:image`, indikator offline, banner fallback) | ✅ Selesai (butir dibatalkan/ditunda lihat catatan di bawah) |
| **W5 — Fitur admin** | `FR-V67-14` (sesi aktif, reset sandi mandiri, upload gambar, backup penuh, paginasi audit, date picker, bulk edit) | ✅ Selesai |
| **W6 — Opsional** | `FR-V67-15` (idempotensi `event_id` pada `log_event`), `FR-V67-16` (PWA `manifest.json` + service worker) | ✅ Selesai |

**Catatan W5 guest — keputusan pemilik (23 Oktober 2026):** Reservasi kamar + tarif (`FR-V67-13` butir 1) **dibatalkan**. Hotel tidak menginginkan kanal booking di halaman tamu ini; halaman memang dirancang untuk tamu yang sudah check-in (review, gerai F&B, promo, WA concierge). Field `reservation_url` pada gerai tetap dipertahankan karena dipakai untuk reservasi **meja/menu F&B**, bukan kamar. Butir lain yang belum dikerjakan dan menunggu keputusan pemilik: galeri properti (butir 4, butuh foto resmi), info fasilitas check-in/out & Wi-Fi (butir 5, butuh data operasional), dan consent analytics sebelum event `visit` terkirim (butir 6, butuh kebijakan privasi hotel).

**Catatan W6 — Turnstile tidak dipasang.** `FR-V67-15` juga menyebut Turnstile; CAPTCHA Cloudflare belum aktif karena butuh akun + site key milik hotel. Pengaman setara yang sudah berjalan: rate limit global `log_event` 300/menit + 60/menit per `device_id`, rate limit `submit_feedback` 3/perangkat/24 jam, honeypot (AF-06), dan idempotensi `event_id`. Pasang Turnstile hanya jika spam tetap lolos setelah itu.

**Verifikasi W4/W5/W6:** `node --check` seluruh modul (`assets/js/**`, `backend/*.gs`, `sw.js`) lolos; 14 skrip smoke JSDOM/backend lolos tanpa galat (guest, admin, bahasa, modal+radiogroup, footer, filter promo, paginasi audit, sesi, bulk sumber, lupa sandi, service worker, login/rate limit W3). Bukti visual browser belum diambil — Chromium arm64 tidak tersedia di lingkungan build.

