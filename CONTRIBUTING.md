# Katkı Rehberi

## Branch isimlendirme

`<tip>/<kisa-aciklama>` formatını kullan:

- `feature/oda-kodu-paylasimi`
- `fix/skor-hesaplama-hatasi`
- `docs/readme-guncelleme`
- `chore/bagimlilik-guncelleme`

Tipler: `feature`, `fix`, `docs`, `chore`, `refactor`, `test`.

## Commit mesajı formatı

[Conventional Commits](https://www.conventionalcommits.org/) stiline uy:

```
<tip>: <kısa açıklama>
```

Örnekler:

- `feat: oda katılma ekranına hata mesajı eklendi`
- `fix: atomik maç bitişinde skor çakışması giderildi`
- `docs: kurulum adımları güncellendi`
- `test: questionSelector için ek senaryolar eklendi`

Açıklama satırı Türkçe veya İngilizce yazılabilir, ama tutarlı olsun. Gövdede "neden" bilgisini kısaca ekle (gerekiyorsa).

## Migration dosyası ekleme kuralı

`supabase/migrations/` klasöründeki dosyalar sıralı şekilde uygulandığı için **adlandırma deseni önemlidir**:

```
YYYYMMDDHHMMSS_aciklama.sql
```

Mevcut örnekler:

```
20261005000000_create_quiz_schema.sql
20261005000001_fix_rpc_grants.sql
20261005000007_atomic_match_finish.sql
```

Kurallar:

- Zaman damgası (`YYYYMMDDHHMMSS`) her yeni migration'da öncekinden **büyük** olmalı, böylece uygulama sırası korunur.
- Açıklama kısmı küçük harf ve alt çizgi (`snake_case`) ile, migration'ın ne yaptığını kısaca anlatmalı (örn. `add_match_timeout_column`).
- Bir migration dosyasını oluşturduktan sonra asla geriye dönüp düzenleme — zaten uygulanmış olabilir. Düzeltme gerekiyorsa yeni bir migration dosyası ekle.
- Yeni migration'ı eklerken, README'deki migration uygulama sırası listesini de güncelle.

## Pull request öncesi kontrol listesi

- `npm run lint`
- `npm test`
- `npm run build`
