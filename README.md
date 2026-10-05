# TEKNOFEST Bilgi Yarışması

Üniversite kulübü etkinlikleri için geliştirilen, iki oyuncunun gerçek zamanlı (realtime) olarak birbirine karşı yarıştığı bir bilgi yarışması oyunu.

## Özellikler

- **1v1 realtime yarışma**: Oda kodu ile oluşturulan odaya ikinci oyuncu katılır, her iki taraf da hazır olduğunda yarışma başlar.
- **Anonim giriş**: Kullanıcılar Supabase Anonymous Auth ile, kayıt olmadan oyuna katılır.
- **Supabase Realtime** ile senkronize soru akışı, cevap bildirimi ve skor güncellemeleri.
- **Bireysel hız (pace) modeli**: Her oyuncu kendi hızında soruları cevaplar, sunucu tarafında atomik puanlama ve maç bitiş kontrolü yapılır (bkz. `supabase/migrations`).
- React + TypeScript + Vite + Tailwind CSS ile geliştirildi.

## Kurulum

### 1. Bağımlılıkları yükle

```bash
npm install
```

### 2. Ortam değişkenlerini ayarla

`.env.example` dosyasını `.env` olarak kopyala ve kendi Supabase proje bilgilerinle doldur:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
```

Bu değerler `src/lib/supabase.ts` içinde Supabase istemcisini oluşturmak ve anonim oturum açmak için kullanılır. Ayarlanmazsa uygulama placeholder değerlerle çalışır ve Supabase özellikleri devre dışı kalır (`isSupabaseConfigured === false`).

### 3. Supabase migration'larını uygula

`supabase/migrations/` klasöründeki `.sql` dosyalarını, **dosya adındaki zaman damgasına göre artan sırayla**, Supabase projenin SQL Editor'ünde çalıştır:

1. `20261005000000_create_quiz_schema.sql`
2. `20261005000001_fix_rpc_grants.sql`
3. `20261005000002_remove_streak.sql`
4. `20261005000003_return_correct_index.sql`
5. `20261005000004_individual_pace_quiz.sql`
6. `20261005000005_fix_question_id_and_answer_idempotency.sql`
7. `20261005000006_final_stabilization.sql`
8. `20261005000007_atomic_match_finish.sql`

Alternatif olarak Supabase CLI kullanıyorsan (bkz. `supabase/config.toml`):

```bash
supabase db reset
```

Önemli: Proje anonim girişe (anonymous sign-in) dayanır; kullandığın Supabase projesinde **Authentication > Providers > Anonymous Sign-Ins** seçeneğinin açık olması gerekir.

## Geliştirme

```bash
npm run dev
```

## Testler

| Komut | Ne çalıştırır |
| --- | --- |
| `npm test` | Vitest: birim/bileşen testleri (`src/**/*.test.ts(x)`) **ve** SQL testleri (`src/test/sql/`) |
| `npm run test:watch` | Vitest izleme modu |
| `npm run test:e2e` | Playwright E2E testleri (`e2e/`) |
| `npm run lint` / `npx tsc -b` | oxlint ve tip kontrolü |

### Birim ve bileşen testleri

Vitest + Testing Library + jsdom ile yazılmıştır (`vite.config.ts` içindeki `test` bölümüne bakınız). `e2e/` klasörü Vitest'in dışında tutulur.

### SQL testleri (PGlite)

`src/test/sql/` altındaki testler, `supabase/migrations/` içindeki tüm migration'ları bellek içi bir Postgres'e ([PGlite](https://pglite.dev)) sırayla uygulayıp RPC'leri doğrudan çağırır. Docker veya Supabase hesabı gerekmez; `npm test` içinde koşar.

> **Sınırlama:** PGlite bağlantısı süper kullanıcı olarak çalıştığı için `GRANT`/`REVOKE` ve Row Level Security (RLS) kuralları **test edilemez**. Bu testler RPC'lerin iş mantığını (`auth.uid()` ve üyelik kontrolleri, puanlama, idempotentlik) doğrular; `anon` rolünün tablolara erişiminin gerçekten kapalı olduğu migration'lardaki `REVOKE` ifadeleri okunarak ya da gerçek bir Supabase projesinde kontrol edilmelidir.

### E2E testleri (Playwright)

İlk kurulumda tarayıcıyı indirin:

```bash
npx playwright install chromium
```

`playwright.config.ts`, `npm run dev -- --port 5179 --strictPort` ile geliştirme sunucusunu kendisi başlatır (açık bir sunucu varsa yeniden kullanır) ve testleri iki projede koşar: `mobile-chromium` (Pixel 7) ve `desktop-chromium`.

- **`e2e/smoke.spec.ts`** — Supabase gerektirmez: ana ekran, isim doğrulaması, oda kodu girişi, `?room=` davet linki, `.env` yokken "yapılandırılmamış" uyarısı, `#/leaderboard` stant modu, `#/admin` ekranı, manifest ve mobilde yatay taşma.

  ```bash
  npx playwright test e2e/smoke.spec.ts
  npx playwright test e2e/smoke.spec.ts --project=mobile-chromium
  ```

- **`e2e/duel.spec.ts`** — gerçek Supabase'e karşı iki ayrı tarayıcı oturumuyla uçtan uca 1v1 düello (oda kur → katıl → HAZIRIM → 10 soru → sonuç → rövanş isteği), sayfa yenileyince odada kalma ve lobiden çıkış senaryoları. Varsayılan olarak **atlanır**. Çalıştırmak için:
  1. Supabase projesinde **Anonymous Sign-Ins** açık olmalı.
  2. Tüm migration'lar uygulanmış olmalı (bkz. "Supabase migration'larını uygula").
  3. `.env` dosyası `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` ile dolu olmalı.
  4. `E2E_SUPABASE=1` ile çalıştırın:

     ```bash
     # bash
     E2E_SUPABASE=1 npx playwright test e2e/duel.spec.ts --project=desktop-chromium
     # PowerShell
     $env:E2E_SUPABASE='1'; npx playwright test e2e/duel.spec.ts --project=desktop-chromium
     ```

  Testler gerçek oda ve maç kayıtları oluşturur (`E2E_` önekli oyuncular); ayrı bir test projesi kullanmanız önerilir.

Başarısız testlerin raporu: `npx playwright show-report`.

### Sürekli entegrasyon (GitHub Actions)

`.github/workflows/ci.yml` her `push` ve `pull_request`'te Ubuntu + Node 22 üzerinde (`npm ci`, npm önbelleği açık) şu job'ları koşar:

| Job | Adımlar |
| --- | --- |
| `lint-typecheck` | `npm run lint`, `npx tsc -b` |
| `unit-and-sql` | `npm test` (PGlite SQL testleri dahil) |
| `build` | `npm run build`, `dist/` artifact olarak yüklenir |
| `e2e-smoke` | `build`'den sonra; `npx playwright install --with-deps chromium`, `npx playwright test e2e/smoke.spec.ts`; başarısızlıkta `playwright-report` artifact olarak yüklenir |

`e2e/duel.spec.ts` Supabase anahtarları (gizli değişkenler) gerektirdiği için CI'da koşmaz; `E2E_SUPABASE` tanımlı olmadığından otomatik olarak atlanır. Yayın öncesinde yerelde yukarıdaki adımlarla çalıştırılmalıdır.

## Build

```bash
npm run build
```

`tsc -b` ile tip kontrolü yapılır, ardından Vite production build alınır.

## Proje Yapısı

```
src/
  components/
    screens/   -> Oyunun ekranları (Home, Lobby, Quiz, Vs, Result vb.)
    common/    -> Ekranlar arası paylaşılan bileşenler
    ui/        -> Genel amaçlı UI bileşenleri
  context/
    GameContext.tsx  -> Oyunun merkezi state yönetimi (React Context + useState/useRef).
                         Oda oluşturma/katılma, hazır olma, soru akışı, cevaplama,
                         skor ve maç bitişi gibi tüm oyun durumunu ve Supabase
                         realtime kanal aboneliğini yönetir.
  lib/
    supabase.ts      -> Supabase istemcisi, yapılandırma kontrolü (isSupabaseConfigured)
                         ve anonim oturum açma (ensureAnonymousSession) yardımcıları.
  data/              -> Soru verisi ve soru seçim mantığı.
  utils/             -> Yardımcı fonksiyonlar (örn. soru seçici).
  types/             -> Paylaşılan TypeScript tipleri.
  test/              -> Test kurulum dosyası (setup.ts) ve test yardımcıları.

supabase/
  migrations/        -> Veritabanı şeması ve RPC fonksiyonlarını oluşturan SQL
                         migration dosyaları, sırayla uygulanmalıdır.
  config.toml        -> Supabase CLI ile yerel geliştirme yapılandırması.
```

## Teknoloji Yığını

- React 19, TypeScript, Vite
- Tailwind CSS 4
- Supabase (Auth, Database, Realtime)
- Vitest, Testing Library (test)
- oxlint (lint)
