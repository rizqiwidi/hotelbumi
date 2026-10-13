# DESIGN NOTES — BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.0

Dokumen ini mendokumentasikan hasil **Redesign Visual Total** untuk *Hotel Bumi Surabaya Digital Guest Experience v6.0* (Guest Landing Page & Admin Management Portal), daftar aset grafis, kepatuhan kontrak teknis, dan panduan untuk engineer pada tahap implementasi selanjutnya.

---

## 1. Konsep & Filosofi Desain

Bumi Surabaya City Resort adalah hotel bintang lima legendaris di jantung Kota Surabaya yang memadukan keasrian oasis taman tropis seluas 4,2 hektar dengan keanggunan budaya hospitality Jawa klasik dan kemewahan modern.

Redesign v6 mengangkat identitas ini secara konsisten:
- **Warna Utama**: Hijau tua botani hotel (`#1a3c2a`, `#143323`, `#0d2217`) sebagai simbol ketenangan alam dan prestise bintang lima.
- **Warna Aksen**: Champagne Gold (`#c9a96e`, `#dfc38d`, `#b08f51`) yang mewah, hangat, dan memberikan kontras berkelas tinggi pada tombol aksi, tipografi, dan border ornamen.
- **Warna Latar & Kontras**: Warm Ivory / Alabaster (`#faf8f5`, `#f6f5f0`) untuk menjaga kehangatan visual dan kenyamanan membaca mata tamu.
- **Tipografi**:
  - *Display / Headings*: **Playfair Display** (editorial luxury serif dengan sentuhan keanggunan klasik).
  - *Status / Eyebrow*: **Cinzel** (capital serif megah untuk status bintang lima dan brand hotel).
  - *Body / UI*: **Plus Jakarta Sans** & **Inter** (sans-serif kontemporer, tajam, dan memiliki keterbacaan tinggi di berbagai resolusi layar ponsel).

---

## 2. Rincian Perombakan Visual

### A. Guest Landing Page (`index.html` & `assets/css/guest.css`)
Halaman tamu didesain dengan pendekatan **Mobile-First** mutlak, mengingat lebih dari 95% tamu membuka tautan melalui tap kartu fisik NFC atau scan QR code meja dari ponsel.

1. **Header & Hero Section**:
   - Menggunakan **logo resmi asli hotel** (`/assets/images/logo-hotel.png`) yang diletakkan dalam kontainer kapsul ivory beraksen border emas dan efek glassmorphism, sehingga dedaunan hijau dan tipografi logo tampil sangat jelas dan berwibawa.
   - **Sapaan Personal Menonjol**: Kartu butler/concierge dengan live indicator dot hijau (`bs-dot`), nama staf bergaris bawah emas, jabatan, dan outlet asal (`#bs-welcome-msg` & `#bs-staff-badge`).
   - **Tombol Aksi Prioritas (High Conversion)**:
     - Tombol **Google Review** bergradasi emas (`#bs-btn-review`) dengan ikon bintang dan micro-interaction shimmer.
     - Tombol **WhatsApp** bergradasi hijau emerald (`#bs-btn-wa`) untuk chat dan reservasi langsung.
   - **Micro Highlights Bar**: 3 badge keunggulan resort (Oasis Tropis di Pusat Kota, 4 Gerai Kuliner Ikonik, Privasi Terjaga & Transparan).
2. **Google Review Section (`#bs-review-section`)**:
   - Tampilan malam hari elegan berlatar emerald dengan 5 bintang emas teranimasi pop-up bertahap, kutipan apresiasi, dan tombol berukuran optimal untuk jari jempol.
3. **Katalog 4 Gerai F&B Ikonik (`#bs-outlets-section`)**:
   - Card modern dengan rasio foto 16:10, zoom hover mulus, tag kapasitas/fasilitas khusus (misal: *Private Room 30 Pax*, *2 Ruang Tatami @10 Pax*), jam buka operasional, deskripsi menu, dan tombol *Eksplorasi Gerai & Reservasi*.
4. **Penawaran Eksklusif / Promosi (`#bs-promos-section`)**:
   - Layout kartu editorial dengan cover foto, label gerai F&B, harga promo berformat nett/pax, dan jadwal periode promo.
5. **Layanan Concierge WhatsApp (`#bs-wa-section`)**:
   - Kartu terkurasi dengan status *"Layanan Pramutamu Aktif"* dan tautan langsung ke WhatsApp tim reservasi.
6. **Floating Mobile Action Bar (`.bs-mobile-action-bar`)**:
   - Bar aksi lengket (sticky) di bagian bawah layar ponsel (<768px) dengan dua tombol cepat (Ulas di Google + Chat WhatsApp) yang selalu dapat diakses tamu saat menjelajahi halaman.
7. **Modal Kebijakan Privasi (`#bs-privacy-modal`)**:
   - Desain bottom-sheet dengan drag handle, badge standar privasi, pemisahan jelas antara *"TIDAK PERNAH diminta"* (merah), data pseudonim yang diproses (hijau), serta tujuan dan masa retensi data.

---

### B. Admin Management Portal (`admin/index.html` & `assets/css/admin.css`)
Panel admin dirombak total menjadi sebuah dashboard manajemen hotel mewah sekelas *Stripe Dashboard / SevenRooms / Toast Hospitality UI*.

1. **Layar Login Admin (`#adm-login-screen`)**:
   - Berlatar radial deep emerald dengan logo resmi hotel, badge enkripsi sesi admin, form login berikon, dan tombol toggle intip password.
2. **Navigasi Sidebar Terstruktur (11 Panel Terpadu)**:
   - **Dashboard Analitik**: 5 KPI Card (Total Kunjungan, Quality Score, Total Ulasan, WA Clicks, Conversion Rate), grafik tren interaktif harian (7 Hari / 30 Hari via Chart.js), Top Staf & Top Gerai leaderboard dengan medali, serta Data Table per sumber dengan filter.
   - **Manajemen Staf & Titik NFC**: Daftar lengkap staf dan meja, status pemrograman kartu NFC, aksi rotasi kode unik, dan tombol sinkronisasi cloud.
   - **Audit Anti-Fraud**: Ringkasan audit anomali, tabel event anomali dengan masking IP/device, dan remedi pendaftaran HP staf ke StaffDevices.
   - **Manajemen Outlet F&B** *(Panel Baru)*: Tampilan grid kartu 4 outlet lengkap dengan foto cover, status operasional, jam buka, fasilitas privat, dan tombol edit.
   - **Nomor WhatsApp Sales** *(Panel Baru)*: Konfigurasi nomor WA per departemen (Wedding & Banquet, MICE Corporate, Reservasi Kamar, F&B Concierge) lengkap dengan template pesan pembuka.
   - **Programmer Kartu NFC**: Antarmuka tulis Web NFC API ke kartu NTAG fisik, penyalin URL, generator QR individual, dan panduan NFC Tools.
   - **Cetak QR Massal** *(Panel Baru)*: Antarmuka cetak multi-kartu dengan pilihan ukuran Kartu Stiker Meja (85 x 54 mm) dan Table Tent Lipat (100 x 70 mm) lengkap dengan tombol cetak batch.
   - **Promosi & Konten Halaman Tamu** *(Panel Baru)*: Pengaturan toggle visibilitas seksi tamu dan tabel daftar promo aktif.
   - **Tampilan & Tema** *(Panel Baru)*: Kustomisasi palet warna dan template teks hero.
   - **Konfigurasi Backend & Fraud Thresholds**: Input endpoint Google Apps Script dan batas ambang AF-01 hingga AF-08.
   - **Pengaturan Akun & Keamanan** *(Panel Baru)*: Form perbarui kata sandi admin dan log sesi keamanan.

---

## 3. Daftar Gambar & Sumber Aset

| Nama File | Path | Sumber / Asal | Penggunaan |
|---|---|---|---|
| `logo-hotel.png` | `assets/images/logo-hotel.png` | Aset resmi Hotel Bumi Surabaya City Resort (3 daun tropis hijau + tipografi resmi) | Header landing page, footer, login admin, dan kop kartu cetak |
| `arumanis.jpg` | `assets/images/outlets/arumanis.jpg` | Foto resmi hotel (interior Jawa megah, ukiran kayu, buffet Nusantara) | Cover outlet Arumanis & promo Pasar Malam |
| `lobby-lounge.jpg` | `assets/images/outlets/lobby-lounge.jpg` | Foto resmi hotel (ruang lounge megah, pilar klasik, karpet motif daun emas, jendela taman) | Cover outlet Lobby Lounge & promo High Tea |
| `kizahashi.svg` | `assets/images/outlets/kizahashi.svg` | **Dibuat Baru (Tahap 1)** — Vektor SVG resolusi tinggi dengan gradien `#1a3c2a` → `#c9a96e`, motif Seigaiha, Kamon Jepang, dan tipografi "KIZAHASHI" | Cover outlet Kizahashi & promo Omakase |
| `delikopi.svg` | `assets/images/outlets/delikopi.svg` | **Dibuat Baru (Tahap 1)** — Vektor SVG resolusi tinggi dengan gradien `#1a3c2a` → `#c9a96e`, ornamen roset kopi, line art cangkir & biji kopi, dan tipografi "DELIKOPI" | Cover outlet DeliKopi & promo Morning Brew |
| `favicon.svg` | `assets/images/favicon.svg` | Vektor ikon bangunan hotel bernuansa hijau-emas | Favicon tab peramban di guest & admin page |

---

## 4. Kepatuhan Kontrak Keras (Compliance Verification)

Seluruh 6 aturan kontrak keras telah ditaati secara ketat:
1. **Atribut `id="..."` TIDAK DIUBAH**:
   Semua ID elemen DOM yang dipakai oleh skrip tamu (`app.js`, `tracking.js`, `fingerprint.js`, `retry-queue.js`) dan skrip admin (`auth.js`, `api.js`, `dashboard.js`, `staff-manager.js`, `anti-fraud.js`, `web-nfc.js`, dan inline controller) dipertahankan 100% tanpa modifikasi atau penghapusan.
2. **Namespace & Fungsi `window.BS*` TIDAK DIUBAH**:
   Semua API global (`window.BSConfig`, `window.BSTracker`, `window.BSApp`, `window.BSAuth`, `window.BSApi`, `window.BSDashboard`, `window.BSStaffManager`, `window.BSAntiFraud`, `window.BSWebNfc`) tetap utuh.
3. **Struktur Data Kompatibel Penuh**:
   Model data event, data sources, thresholds anti-fraud, dan struktur config tetap sesuai schema awal; outlet diperkaya dengan atribut pendukung (`hours`, `highlight`, `image_url`) tanpa merusak parser yang ada.
4. **Situs Statis Multi-File**:
   Tidak ada build tools (tidak memerlukan npm/webpack/vite), murni HTML, CSS, dan Vanilla JavaScript.
5. **Folder `backend/` dan `docs/` Tidak Disentuh**:
   Seluruh pengerjaan hanya dilakukan di folder `app/` (`index.html`, `admin/index.html`, `assets/css/`, `assets/js/`, `assets/images/`).
6. **Verifikasi Referensi Berkas (`src=` / `href=`)**:
   Tidak ada tautan berkas yang hilang atau 404 (tautan lama `favicon.ico` yang tidak ada di disk telah dibersihkan sehingga hanya memanggil `favicon.svg`).

---

## 5. Catatan untuk Engineer Tahap Selanjutnya

1. **Integrasi CRUD Outlet ke Google Sheets**:
   - Di `admin/index.html` pada tab `tab-outlets`, tombol dan kartu telah disediakan secara statis/mock.
   - Untuk backend engineer: tambahkan aksi `get_outlets` dan `save_outlets` pada Google Apps Script backend jika outlet ingin dapat ditambah/diedit langsung dari spreadsheet.
2. **Integrasi Nomor WhatsApp Sales**:
   - Nomor WhatsApp sales di `tab-sales-wa` saat ini siap dihubungkan ke `BSConfig.DEFAULTS.whatsapp_settings` atau tab konfigurasi sheet baru.
3. **Batch QR Printing**:
   - Di `tab-bulk-qr`, tombol *Cetak Semua Kartu Terpilih* memicu `window.print()`. Styling telah disiapkan di `assets/css/print.css` agar membagi kartu rapi dalam 2 kolom per halaman (ukuran 85 x 54 mm).
   - Jika ingin me-render QR secara dinamis untuk seluruh staf yang ada di `BSStaffManager.getSources()`, cukup panggil loop `new QRCode()` ke dalam wadah `.adm-bulk-preview-grid`.
4. **Cache Invalidation**:
   - Setiap perubahan data di portal admin otomatis memanggil `BSConfig.clearCache()` saat sinkronisasi sukses, memastikan tamu yang membuka halaman berikutnya langsung menerima data termutakhir.
