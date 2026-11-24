# TopSim — Oddly Satisfying Ball Simulations for Shorts & Reels

Next.js (App Router) + TypeScript + Tailwind CSS web app that renders **30 physics-based, ASMR / "oddly satisfying" ball simulations** in a fixed **9:16** frame, with a **procedural Web Audio sound engine** and **automatic 9:16 video recording** (canvas + audio → MP4/WebM).

## Özellikler

- **9:16 sahne** (1080×1920 veya 720×1280 iç çözünürlük), koyu arka plan, üstte hook başlığı + dinamik sayaçlar (`BALLS: 21`, hedef, ilerleme / renk payı barları).
- **30 simülasyon**, 4 kategori: Çoğalma & Katlanma (10), Pervane & Engeller (8), Renk Yarışı & Taşma (6), Fizik & Etkileşim (6).
- **Geçiş:** yukarı/aşağı swipe, fare tekerleği, `↑ / ↓`, seçici menü. URL hash ile derin link (`/#gate-multiplier`).
- **Etkileşim:** sahneye tıkla/dokun → simülasyona özel aksiyon (yeni top, şok dalgası, kapı çevirme, pervaneyi ters döndürme…).
- **Ses motoru (Web Audio API):** harici dosya yok. Marimba, Soft Synth, Bubble Pop, Tick, Glass profilleri; çarpışma hızı → ses şiddeti, top boyutu → perde (pentatonik), x konumu → stereo pan. Ses aç/kapa, seviye, profil seçimi. Ses çıkışı kayda dahildir.
- **Video kayıt:** Manuel başlat/durdur + **Otomatik Kayıt** (15 / 30 / 60 sn, “simülasyon tamamlanınca” veya “top sayısı eşiği”). Otomatik kayıt simülasyonu sıfırlar, kaydeder, bitince dosyayı indirir. Ekranda `REC + süre` göstergesi (kayda girmez).
- **Temiz kayıt görünümü:** panel `H` ile gizlenir, `F` ile tam ekran.
- **Performans:** `requestAnimationFrame` + delta-time, sabit alt adımlar (substep), uniform spatial hash ile top-top çarpışması, top/parçacık sınırları, renk bazlı toplu çizim.

## Mimari

```
app/                    Next.js App Router (layout, page, globals.css)
components/
  StudioLoader.tsx      next/dynamic ssr:false – tarayıcı API'leri SSR'a girmez
  Studio.tsx            Ana döngü, input (swipe/klavye/tıklama), kayıt akışı
  ControlPanel.tsx      Gizlenebilir kontrol paneli
lib/engine/
  types.ts              Ball, Segment, Peg, Ring, Bounds, Hud, hook tipleri
  world.ts              Fizik dünyası (substep, spatial hash, çarpışmalar, olaylar)
  render.ts             Canvas renderer + HUD
lib/audio/AudioEngine.ts   Prosedürel ASMR ses motoru
lib/recorder/Recorder.ts   canvas.captureStream + MediaRecorder kaydı
simulations/
  types.ts              SimDef / SimInstance arayüzü
  helpers.ts            Ortak arena, rotor, palet, yardımcılar
  registry.ts           Merkezi kayıt (tüm simülasyonlar)
  multiply/  obstacles/  color/  physics/   Kategori bazlı simülasyonlar
```

Yeni simülasyon eklemek için ilgili kategori dosyasında bir `SimDef` yazıp kategorinin dizisine eklemek yeterlidir.

## Kısayollar

| Tuş | İşlev |
| --- | --- |
| ↑ / ↓, swipe, tekerlek | Önceki / sonraki simülasyon |
| Tıkla / dokun | Etkileşim |
| Space | Duraklat |
| R | Yeniden başlat (Chaos Mix'te yeni senaryo) |
| H | Paneli gizle/göster |
| M | Ses aç/kapa |
| V | Manuel kayıt başlat/durdur |
| F | Tam ekran |

## Geliştirme

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

Vercel'e ek ayar gerekmeden deploy edilir (Framework: Next.js).
