# OKÜ TEKNOFEST Bilgi Yarışması — Tasarım Rehberi

Sade, açık zeminli, mobil öncelikli bir arayüz. Kimlik kulüp logosundan gelir
(`public/oku-teknofest-logo.jpg`): roket/kanat **mavisi**, TEKNOFEST **kırmızısı**, beyaz.

## Yapma
- Gradient (`bg-gradient-*`, `bg-clip-text`), neon parıltı, `text-shadow`, renkli gölge yok.
- Cyan / mor / pembe / teal yok. Eski sınıflar (`box-glow-*`, `text-glow-*`, `cyber-*`,
  `font-heading`, `font-subheading`) artık tanımlı değil; kullanma.
- Sonsuz dekoratif animasyon yok (`animate-ping`, `animate-bounce`, sürekli `animate-pulse`).
  Hareket yalnızca durum değişince ve kısa (≤200 ms) olsun.
- Her yeri BÜYÜK HARF yapma, geniş harf aralığı (`tracking-widest`) kullanma.
- Gereksiz rozet/etiket ("ESPORTS", "ARENA", "CANLI 1V1 DÜELLO" gibi) koyma.

## Renk token'ları (Tailwind sınıfı olarak kullan)
| Amaç | Sınıf |
|---|---|
| Sayfa zemini | `bg-canvas` |
| Kart/yüzey | `bg-surface`, ikincil yüzey `bg-subtle` |
| Çizgi | `border-line`, belirgin `border-line-strong` |
| Ana metin / ikincil / soluk | `text-ink`, `text-ink-soft`, `text-muted` |
| Marka (birincil eylem, seçili durum) | `bg-brand`, `text-brand`, `bg-brand-soft`, `border-brand-line` |
| Vurgu (az kullan: rakip, kritik an) | `text-accent`, `bg-accent-soft` |
| Doğru / Yanlış / Uyarı | `success`, `danger`, `warning` (+ `-soft` zeminleri) |

Oyuncu ayrımı: **sen = brand (mavi)**, **rakip = ink/nötr**; kırmızı yalnızca yanlış cevap,
hata, son 10 saniye gibi anlamlı durumlarda.

## Tipografi
- Gövde: Inter (`font-sans`, varsayılan). Başlıklar `font-semibold`/`font-bold`, normal harf.
- Skor, sayaç, oda kodu gibi büyük rakamlar: `font-display` (Barlow Semi Condensed) + `tabular`.
- Boyutlar: sayfa başlığı `text-xl`/`text-2xl`, bölüm başlığı `text-base font-semibold`,
  gövde `text-[15px]`/`text-sm`, yardımcı metin `text-xs text-muted`.
- **Input'lar en az 16px (`text-base`)** — iOS aksi hâlde odaklanınca sayfayı yakınlaştırır.

## Bileşenler (`src/components/ui/`)
- `Button` — `variant`: `primary` (ekranda bir tane ana eylem), `secondary`, `accent`
  (seyrek), `ghost`, `danger`; `size`: `sm`/`md`/`lg`; `fullWidth`. Yükseklik ≥ 44 px (dokunma hedefi).
- `Card` — `variant`: `default` (beyaz), `muted`, `brand`; `padding`: `none`/`sm`/`md`.
- `Badge` — `neutral`, `brand`, `accent`, `success`, `warning`, `danger`.
- `Logo` — daire içinde kulüp logosu. `LogoSpinner` / `LogoSpinnerBlock` — yükleniyor göstergesi
  (logonun etrafında dönen yörünge). `Loader2` gibi genel spinner'lar yerine bunu kullan;
  buton içinde küçük durumlar için `Loader2` (16 px) kabul.
- İkonlar: `lucide-react`, 16–20 px, `strokeWidth` varsayılan; dekoratif ikonları azalt.

## Yerleşim
- Mobil öncelikli: 360 px genişlikte yatay kaydırma olmamalı. Ekranlar `max-w-md` içinde
  (App zaten sarıyor), dikey boşluk `space-y-4`/`gap-4`.
- Kartlar `rounded-2xl`, butonlar/input'lar `rounded-xl`, avatar/rozet `rounded-full`.
- Ana eylem ekranın altında, başparmakla erişilebilir yerde; tam genişlik.
- Erişilebilirlik: görünür odak (global `:focus-visible` var), ikon butonlarına `aria-label`,
  renk tek başına anlam taşımasın (doğru/yanlışta ikon + metin de olsun).

## Ton
Kısa, samimi, Türkçe cümle düzeni: "Oda kur", "Hazırım", "Rövanş iste". Ünlem ve abartı yok.
