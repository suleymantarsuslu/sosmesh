# M0 fiziksel kanıt klasörü

**Durum:** Henüz gerçek cihaz testi yapılmadı (`NOT_TESTED`). Bu dizin boş veya yalnızca şablon dosyalar içerebilir; **sentetik/sahte log üretmeyin**.

## Beklenen artefaktlar (PASS sonrası)

| Dosya | Açıklama |
| --- | --- |
| `logcat-a.redacted.log` | Telefon A — `scripts/m0/collect-logs.sh` |
| `logcat-b.redacted.log` | Telefon B — aynı script |
| `api-trace-<correlation-id>.json` | `scripts/m0/fetch-api-trace.sh` çıktısı (yerel API, token env) |
| `panel-recording.mp4` | Operatör paneli ekran kaydı (opsiyonel) |
| `m0-physical-report-filled.md` | `docs/tests/m0-physical-report.md` doldurulmuş kopya |

## Scriptler

```bash
# Android log (adb + tek cihaz gerekir; cihaz yoksa anlamlı hata, exit ≠ 0)
bash scripts/m0/collect-logs.sh "<correlation-uuid>" evidence/m0/logcat-a.redacted.log

# API olay izi (yalnız localhost/test API; correlation ID URL-encode edilir)
# Operatör JWT: OPERATOR_BEARER_TOKEN ortam değişkeni (değer repoya yazılmaz)
export OPERATOR_BEARER_TOKEN
bash scripts/m0/fetch-api-trace.sh "<correlation-uuid>" > evidence/m0/api-trace.json
```

## Redaksiyon (gerçek davranış)

**Logcat (`collect-logs.sh` → `redact-logcat.mjs`):**

- Koordinat desenleri → `[REDACTED_COORD]`
- E-posta → `[REDACTED_EMAIL]`; 10–14 haneli telefon benzeri sayılar → `[REDACTED_PHONE]`
- `message=`, `msg=`, `text=`, `plaintext:`, `note=`, `body=`, `sosText` (büyük/küçük harf duyarsız) anahtarından **satır sonuna kadar** → `[REDACTED_TEXT]`

**API trace (`fetch-api-trace.sh` → `redact-api-trace.jq`):**

- `latitude`, `longitude`, `lat`, `lng`, `koordinat` alanları → `[REDACTED_COORD]` veya metin ise `[REDACTED_TEXT]`
- `originalText`, `operatorDisplayText`, `message`, `body`, `note`, `text`, `plaintext`, `displayText`, `sosText` ve audit `before`/`after` içindeki serbest metin → `[REDACTED_TEXT]`
- Uzun stringler, e-posta ve telefon desenleri ek maskeler

Otomatik testler: `tests/chaos/m0-redact-logcat.test.ts`, `tests/chaos/m0-redact-api-trace.test.ts` (`pnpm test`).

## Gizlilik

Gerçek GPS, sağlık verisi, telefon numarası veya SOS metni **repoya commit edilmez**. Script çıktıları yukarıdaki kuralları uygular; commit öncesi yine de gözden geçirin.
