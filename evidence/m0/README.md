# M0 fiziksel kanıt klasörü

**Durum:** Henüz gerçek cihaz testi yapılmadı (`NOT_TESTED`). Bu dizin boş veya yalnızca şablon dosyalar içerebilir; **sentetik/sahte log üretmeyin**.

## Beklenen artefaktlar (PASS sonrası)

| Dosya | Açıklama |
| --- | --- |
| `logcat-a.redacted.log` | Telefon A — `scripts/m0/collect-logs.sh` (PII/GPS/SOS metni maskeli) |
| `logcat-b.redacted.log` | Telefon B — aynı script |
| `api-trace-<correlation-id>.json` | `scripts/m0/fetch-api-trace.sh` çıktısı (yerel API, token env) |
| `panel-recording.mp4` | Operatör paneli ekran kaydı (opsiyonel) |
| `m0-physical-report-filled.md` | `docs/tests/m0-physical-report.md` doldurulmuş kopya |

## Scriptler

```bash
# Android log (adb + tek cihaz gerekir; cihaz yoksa anlamlı hata, exit ≠ 0)
bash scripts/m0/collect-logs.sh "<correlation-uuid>" evidence/m0/logcat-a.redacted.log

# API olay izi (yalnız localhost/test API)
export OPERATOR_BEARER_TOKEN="<operatör JWT>"
bash scripts/m0/fetch-api-trace.sh "<correlation-uuid>" > evidence/m0/api-trace.json
```

## Gizlilik

Gerçek GPS, sağlık verisi, telefon numarası veya SOS metni **repoya commit edilmez**. Script çıktıları redaksiyon uygular; yine de commit öncesi gözden geçirin.
