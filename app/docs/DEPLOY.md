# DEPLOY.md — Langkah Deploy ke Cloudflare Pages

Panduan ini menjelaskan cara mendeploy seluruh aplikasi **Bumi Surabaya Digital Guest Experience v5.0**
ke **Cloudflare Pages** dari repositori Git.

> [!IMPORTANT]
> Prasyarat: Backend Google Sheets + Apps Script **harus sudah aktif** sebelum deploy frontend.
> Lihat [SHEETS_SETUP.md](./SHEETS_SETUP.md) untuk panduan backend.

---

## Prasyarat

- Akun Cloudflare (gratis cukup)
- Repositori Git (GitHub / GitLab) yang berisi folder `app/` dari proyek ini
- URL Web App Google Apps Script yang sudah di-deploy dan berjalan

---

## 1. Persiapan Repositori

Pastikan struktur direktori proyek `app/` sudah lengkap sesuai PRD §4.1:

```
app/
├── index.html              ← Halaman tamu (publik)
├── admin/
│   └── index.html          ← Portal admin (terlindungi)
├── assets/
│   ├── css/
│   │   ├── guest.css
│   │   ├── admin.css
│   │   └── print.css
│   ├── js/
│   │   ├── config.js
│   │   ├── guest/
│   │   │   ├── app.js
│   │   │   ├── tracking.js
│   │   │   ├── fingerprint.js
│   │   │   └── retry-queue.js
│   │   └── admin/
│   │       ├── auth.js
│   │       ├── api.js
│   │       ├── dashboard.js
│   │       ├── staff-manager.js
│   │       ├── anti-fraud.js
│   │       └── web-nfc.js
│   └── images/
│       └── logo-gold.svg
├── backend/
│   ├── Code.gs
│   ├── Triggers.gs
│   └── appsscript.json
└── docs/
    ├── SHEETS_SETUP.md
    ├── DEPLOY.md
    └── ASSUMPTIONS.md
```

> [!NOTE]
> Folder `backend/` **tidak perlu** di-deploy ke Cloudflare — isinya hanya dipakai di Google Apps Script.
> Cloudflare hanya membutuhkan file statis (`index.html`, `admin/`, `assets/`).

---

## 2. Push ke GitHub / GitLab

```bash
# Di root repositori
cd /path/to/bumi-surabaya-v5

git add app/
git commit -m "feat: deploy v5 — multi-file modular architecture"
git push origin main
```

---

## 3. Buat Project di Cloudflare Pages

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Klik **Workers & Pages** di sidebar → **Create application** → **Pages**.
3. Klik **Connect to Git**.
4. Pilih **GitHub** (atau GitLab) dan izinkan akses repositori.
5. Pilih repositori proyek Bumi Surabaya.

---

## 4. Konfigurasi Build

Isi formulir konfigurasi build berikut:

| Pengaturan | Nilai |
|---|---|
| **Project name** | `bumi-surabaya-guest` (atau nama bebas) |
| **Production branch** | `main` |
| **Framework preset** | `None` |
| **Build command** | *(kosongkan)* |
| **Build output directory** | `app` |
| **Root directory** | `/` (root repositori) |

> [!TIP]
> **Build output directory** adalah `app` — Cloudflare akan menyajikan isi folder `app/` sebagai root website.
> Ini berarti `app/index.html` akan tersedia di `https://[domain]/` dan `app/admin/index.html` di `https://[domain]/admin/`.

Klik **Save and Deploy**.

---

## 5. Konfigurasi Domain Kustom

### Subdomain Cloudflare Pages (Gratis)
Setelah deploy pertama berhasil, project akan tersedia di:
```
https://bumi-surabaya-guest.pages.dev
```

### Domain Kustom Hotel
Jika hotel memiliki domain sendiri (contoh: `guest.bumisurabaya.com`):

1. Di Cloudflare Pages → **Custom domains** → **Set up a custom domain**.
2. Masukkan `guest.bumisurabaya.com`.
3. Ikuti instruksi untuk menambahkan DNS record CNAME di Cloudflare DNS:
   ```
   CNAME   guest   →   bumi-surabaya-guest.pages.dev
   ```
4. Cloudflare akan otomatis provisioning sertifikat SSL (HTTPS).

---

## 6. Konfigurasi Pertama Kali di Browser Admin

Setelah deploy berhasil:

1. Buka `https://[domain]/admin/`.
2. Isi form login:
   - **URL GAS Backend**: URL Web App dari Google Apps Script
   - **READ_TOKEN**: Token rahasia yang sudah diset di Script Properties
3. Klik **Masuk ke Dashboard**.
4. Verifikasi data tampil dengan benar (klik **Perbarui**).
5. Tambahkan staf pertama via menu **Staf & Sumber** → **+ Tambah Baru**.
6. Klik **Simpan & Sinkronkan ke Cloud** untuk menyimpan ke Google Sheets.

---

## 7. Pengujian End-to-End

Setelah konfigurasi selesai, lakukan pengujian berikut:

### Uji Tamu
1. Buka `https://[domain]/?source=staff-budi-santoso`
2. Halaman harus menampilkan sapaan: *"Dilayani oleh Budi Santoso"*
3. Klik tombol Google Review → event `google_review_click` harus tercatat di Sheets

### Uji Isolasi Keamanan
1. Buka `https://[domain]/` → View Source
2. **Tidak boleh** ada kode admin, token, atau kredensial apapun di source code

### Uji Admin
1. Login di `/admin/` → Dashboard harus memuat data dari Sheets
2. Tambah staf baru → sinkronkan → buka URL staf baru di tab lain → sapaan muncul

### Uji Offline Retry
1. Buka halaman tamu → matikan WiFi → klik Google Review
2. Nyalakan WiFi kembali → event harus terkirim otomatis (cek Sheets)

---

## 8. Update / Redeploy

Setiap `git push` ke branch `main` akan otomatis memicu build dan deploy ulang di Cloudflare Pages.

Jika ada perubahan konfigurasi yang perlu langsung terlihat:
1. Di Cloudflare → **Caching** → **Purge Everything** (opsional, jika CDN cache tidak kedaluwarsa)
2. Atau gunakan **Cache Rules** untuk mengatur TTL berdasarkan path

---

## 9. Rollback

Jika deploy terbaru bermasalah:
1. Di Cloudflare Pages → pilih project → **Deployments**
2. Klik deployment yang stabil sebelumnya → **Rollback to this deployment**

---

## Checklist Sebelum Go-Live

- [ ] Backend Apps Script berjalan dan `get_config` mengembalikan data valid
- [ ] Domain kustom + SSL aktif
- [ ] Halaman tamu `/?source=staff-test` menampilkan sapaan personal
- [ ] View Source halaman tamu tidak mengandung kode atau token admin
- [ ] Login admin berhasil dengan token yang benar
- [ ] Trigger laporan email dicoba manual (`laporanMingguan()`) dan email terkirim
- [ ] Kartu NFC fisik sudah diprogram dan diuji tap dari jarak dekat
