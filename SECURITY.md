# Güvenlik politikası — SOSMesh

## Kapsam

Bu depo SOSMesh acil durum mesh prototipini içerir. **SOSMesh resmî 112 veya başka bir acil çağrı hizmetinin yerine geçmez.**

## Güvenlik açığı bildirimi

| Alan | Değer |
| --- | --- |
| **Durum** | `BLOCKED_APPROVAL` — prod iletişim kanalı henüz onaylanmadı |
| **E-posta (yer tutucu)** | `GUVENLIK_BILDIRIM_TBD` |
| **PGP (opsiyonel)** | Anahtar yayımlanmadı — `BLOCKED_APPROVAL` |
| **Yanıt hedefi** | İlk yanıt: 5 iş günü (hedef; prod SLA onayı gerekir) |

Lütfen raporlarda **gerçek GPS, telefon, sağlık veya kimlik verisi** eklemeyin; sentetik veya redakte edilmiş örnekler kullanın.

### Beklenen bilgiler

1. Etkilenen sürüm / commit SHA (mümkünse)
2. Tekrarlanabilir adımlar
3. Etki (gizlilik, bütünlük, kullanılabilirlik)
4. Önerilen düzeltme (varsa)

### Kapsam dışı

- Sosyal mühendislik, fiziksel erişim, üçüncü taraf hizmetlerin genel sorunları
- DoS yalnızca prod ortamına karşı (önceden yazılı izin olmadan)

## Tehdit modeli

Ayrıntılar: [`docs/security/threat-model.md`](docs/security/threat-model.md)

## Mağaza / prod dağıtım

Prod imzalama, DNS, staging/prod deploy ve public push **bu aşamada uygulanmadı** (`BLOCKED_APPROVAL`).
