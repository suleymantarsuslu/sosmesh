# Güvenlik politikası — SOSMesh

## Kapsam

Bu depo SOSMesh acil durum mesh prototipini içerir. **SOSMesh resmî 112 veya başka bir acil çağrı hizmetinin yerine geçmez.**

## Güvenlik açığı bildirimi / Reporting a vulnerability

**TR:** Bir güvenlik açığı bulduysanız lütfen herkese açık bir issue açmayın; ayrıntıları **[bilgi@edavam.com](mailto:bilgi@edavam.com)**
adresine e-postayla gönderin (konu satırına `[SOSMesh security]` yazın). Raporu aldığımızı onaylar, düzeltme hazır olana kadar
ayrıntıları gizli tutar ve uygun olursa düzeltme yayımlandığında katkınızı anarız. Lütfen sorunu düzeltmemize fırsat vermeden
açıklamayın ve başkalarının verilerine erişmeyin.

**EN:** If you find a security vulnerability, please do not open a public issue. Email the details to
**[bilgi@edavam.com](mailto:bilgi@edavam.com)** (subject: `[SOSMesh security]`). We will acknowledge your report, keep the details
private until a fix is ready, and credit you when the fix is released if you wish. Please give us reasonable time to fix the issue
before any public disclosure, and do not access other people's data.

| Alan / Field | Değer / Value |
| --- | --- |
| **E-posta / Email** | [bilgi@edavam.com](mailto:bilgi@edavam.com) |
| **PGP (opsiyonel / optional)** | Anahtar yayımlanmadı / Not published yet |
| **Yanıt hedefi / Response target** | İlk yanıt: 5 iş günü (hedef) / First response: 5 business days (target) |

Lütfen raporlarda **gerçek GPS, telefon, sağlık veya kimlik verisi** eklemeyin; sentetik veya redakte edilmiş örnekler kullanın.
Please do not include **real GPS, phone, health or identity data** in reports; use synthetic or redacted examples.

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
