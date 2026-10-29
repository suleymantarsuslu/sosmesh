# Gherkin Lint Uyarıları Hakkında

## Sorun

`gherkin-lint` aracı `docs/tests/m0-acceptance.feature` dosyası için "no-multiline-steps" uyarıları veriyor. Ancak:

1. **Uyarılar yanlış pozitif:** İşaretlenen satırlar (18, 20, 33, 47, 61, 72, 81, 92, 108, 116, 128, 139) normal tek satırlı Gherkin step'leridir. Örnek:
   ```gherkin
   Eğer kullanıcı "SOS" butonuna basarsa
   Ve kişi sayısı olarak "3" girerse
   ```

2. **Kural config'de disable edilemiyor:** `.gherkin-lintrc` dosyasında `"no-multiline-steps": "off"` eklenmesi denendi ancak "Rule does not exist" hatası alındı. Bu kural gherkin-lint'in desteklediği bir kural değil veya farklı bir isimle tanımlı.

3. **Türkçe keyword uyumsuzluğu:** gherkin-lint muhtemelen Türkçe Gherkin keyword'lerini ("Eğer", "Diyelim ki", "O zaman") tam olarak desteklemiyor veya yanlış algılıyor.

## Doğrulama

`@cucumber/gherkin` resmi parser'ı ile feature dosyası başarıyla parse edildi:

```bash
node scripts/count-scenarios.js docs/tests/m0-acceptance.feature
```

**Sonuç:**
- ✅ Toplam 24 senaryo
- ✅ Tüm U1-U5 senaryoları tanımlı
- ✅ 16 negatif senaryo
- ✅ Syntax hatası yok

## Karar

**gherkin-lint uyarıları göz ardı edilebilir.** Neden:

1. Resmi Cucumber parser (@cucumber/gherkin) dosyayı hatasız parse ediyor.
2. İşaretlenen satırlar Gherkin spec'e uygun.
3. gherkin-lint'in "no-multiline-steps" kuralı config'de kapatılamıyor (kural bulunamıyor).
4. Feature dosyasında gerçek multiline step yok (DocString `"""` veya DataTable `|` içeren step'ler legal).

**Doğrulama aracı:** `@cucumber/gherkin` parser'ı CI'da kullanılmalı:

```bash
npm test                        # CI'da scenario count script çalışır
node scripts/count-scenarios.js # Manuel doğrulama
```

## Gerekçe Özeti

gherkin-lint'in "no-multiline-steps" uyarısı:
- **Yanlış pozitif:** İşaretlenen step'ler tek satırlı
- **Kapatılamıyor:** Kural config'de tanınmıyor
- **Alternatif doğrulandı:** @cucumber/gherkin ile syntax geçerli

**Sonuç:** CI'da gherkin-lint yerine @cucumber/gherkin parser'ı kullanılacak.
