# FLOW — Aplikasi Keuangan UMKM (Frontend Prototype)

Prototipe aplikasi keuangan UMKM yang **berfungsi penuh** tanpa backend. Semua data disimpan di `localStorage` browser.

## Cara Menggunakan

1. Buka file `index.html` di browser — tidak perlu server.
2. Daftar akun baru → Buat profil perusahaan → Mulai gunakan aplikasi.

## Fitur

- **Registrasi & Login** — Daftar akun, masuk, dan keluar
- **Onboarding Perusahaan** — Buat profil bisnis dengan bagan akun otomatis
- **Dashboard** — Ringkasan saldo kas, pendapatan, tagihan belum lunas
- **Tagihan (Invoice)** — Buat tagihan baru dengan detail barang/jasa, kirim, dan terima pembayaran
- **Jurnal Umum** — Jurnal otomatis (double entry) saat tagihan dikirim & pembayaran diterima, plus jurnal manual
- **Kontak** — Kelola pelanggan dan vendor
- **Bagan Akun** — Kelola chart of accounts (hierarki akun)
- **Laporan Keuangan** — Neraca Saldo, Laba Rugi, Neraca, Arus Kas (dengan filter tanggal)
- **Multi Perusahaan** — Buat dan kelola lebih dari satu perusahaan
- **Manajemen Tim** — Tambah karyawan dengan peran ADMIN atau KASIR (Role-Based Access Control)
- **Responsif** — Tampilan adaptif untuk desktop dan mobile

## Teknologi

- HTML5 + CSS3 + Vanilla JavaScript (tanpa framework)
- localStorage untuk penyimpanan data
- SPA (Single Page Application) dengan hash-based routing
