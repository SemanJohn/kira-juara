# Kira Juara ➕➖

Permainan latihan **tambah & tolak** untuk murid sekolah rendah. Rakan kepada [Sifir Juara](https://semanjohn.github.io/sifir-juara/).

**Main:** https://semanjohn.github.io/kira-juara/

## Ciri

- **Time Trial 60 saat** — pilih operasi (➕ Tambah / ➖ Tolak / 🔀 Campur) × 4 tahap
  - Mudah (jawapan ≤ 20) · Sederhana (2 digit) · Sukar (3 digit) · Hero (soalan terbalik `? + 8 = 15`)
- **Latihan bebas** — pilih operasi & julat sendiri, 20 soalan, tiada had masa
- **Sistem streak** — 3 betul = 1 streak (+3 saat) · 3 streak = beku 5 saat · 3 beku = masa penuh semula
- **9 lencana**, matlamat harian 30 betul, papan markah tempatan + global
- Numpad skrin sentuh + sokongan papan kekunci (`0-9`, `Backspace`, `Enter`)
- Berfungsi sepenuhnya **offline**; markah dihantar ke pelayan bila ada sambungan

## Fail

| Fail | Guna |
|---|---|
| `index.html` | Keseluruhan permainan — satu fail, tiada dependency |
| `Code.gs` | Backend Google Apps Script (papan markah global + statistik harian) |
| `.nojekyll` | Elak GitHub Pages memproses fail dengan Jekyll |

## Pasang backend (Google Sheet sebagai database)

1. Cipta Google Sheet baharu, namakan **Kira Juara DB**
2. **Extensions → Apps Script**, tampal isi `Code.gs`, simpan
3. Run fungsi `setup()` sekali (beri kebenaran)
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin *Web app URL* (berakhir `/exec`) dan letak dalam `index.html`:

```js
const API_URL='https://script.google.com/macros/s/XXXX/exec';
```

Kalau `API_URL` dibiar kosong, permainan tetap jalan — cuma tanpa papan markah global.

### Struktur Sheet

**Scores** — satu baris setiap sesi
`ts, tarikh, id, nama, kelas, mode, operasi, tahap, markah, betul, silap, soalan, streak, kejituan`

**Daily** — ringkasan sehari sepemain
`tarikh, id, nama, kelas, sesi, betul, silap, markahTerbaik, streakTerbaik, markahJumlah`

### Endpoint

Semua guna GET + JSONP (tiada isu CORS dari GitHub Pages).

| Action | Parameter | Pulangan |
|---|---|---|
| `ping` | — | `{ok, time}` |
| `submit` | `id, nama, kelas, mode, op, tahap, markah, betul, silap, streak` | `{ok, id, kedudukan}` |
| `leaderboard` | `op, tahap, limit` | `{ok, rows[]}` — markah terbaik setiap pemain |
| `me` | `id` | `{ok, jumlah, harian[]}` |

> Selepas mengubah `Code.gs`, buat **Deploy → Manage deployments → Edit → New version** supaya URL sedia ada menggunakan kod terbaharu.

## Nota privasi

Tiada log masuk. Pemain dikenali melalui ID rawak yang disimpan dalam peranti. Hanya nama panggilan & kelas yang dimasukkan sendiri akan muncul di papan markah.
