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

## Test

```bash
npm test
```

İzleme modu (dosya değişikliklerinde otomatik çalıştırma):

```bash
npm run test:watch
```

Testler Vitest + Testing Library + jsdom ile yazılmıştır (`vite.config.ts` içindeki `test` bölümüne bakınız).

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
