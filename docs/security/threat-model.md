# SOSMesh Güvenlik Tehdit Modeli (ADIM 43)

**Kapsam:** Monorepo uçtan uca — BLE/mesh taşıma, protocol-v2 çok atlama röle, NestJS ingest/operatör API, Next.js panel, yerel kripto.  
**Yöntem:** STRIDE + TARA (tehdit → saldırı yüzeyi → mevcut kontrol → test/kanıt → bulgu).  
**Bağımsız denetim:** `NOT_TESTED` — üçüncü taraf penetrasyon veya kod denetimi bu adımda yapılmadı; yalnızca otomatik testler ve iç tehdit modeli.

## Kırmızı çizgiler (değişmez)

| İlke | Tehdit modeli karşılığı |
|------|-------------------------|
| SOSMesh resmî 112/acil çağrı yerine geçmez | UI/API metinleri; yasak “teslim/ kurtarıldı” etiketleri (`scripts/ux-forbidden-copy.js`) |
| Offline BLE AI’sız çalışır | Mesh/BLE yolu Meta API’ye bağlanmaz |
| Röle SOS düz metnini görmez | `opaqueCiphertextBase64`, `relayLogSnapshot`, Android mesh production guard testleri |
| Peer ACK ≠ operatör okundu / kurtarma | `PEER_RECEIVED_ONLY`, ingest `SERVER_ACCEPTED` ayrımı |
| AI triyaj/kurtarma kararı vermez | Meta worker şema + operatör onayı (ADIM 20–23) |
| Gerçek GPS/PII/sağlık repoda/logda yok | Sentetik fixture; `scripts/secret-scan.sh`, pino redact (ADIM 17) |

## Bağımlılık ADIM 34 / PR #48

**Durum:** ADIM 34 (iOS↔Android çapraz entegrasyon) henüz `main`’de değil; açık PR **#48** (`cursor/ios-adim-34-41-cross-multihop-083f`).

Bu dalda tehdit modeli **34’ün yüzeyini yalnızca sözleşme/protokol düzeyinde** ele alır:

- `packages/contracts/protocol-v2/` — `mesh-relay-envelope-v2.schema.json`, `relay-engine-cases.json`
- Peer ACK semantiği: `peerAckHint: PEER_RECEIVED_ONLY` (operatör/kurtarma iddiası yok)
- iOS native çapraz BLE kanıtı **SEC-ADIM34-001** → `NOT_TESTED` (`findings.csv`)

**#48 `main`’e girdikten sonra:** `git fetch origin && git merge origin/main`, ardından adversarial + çapraz vektör testlerini güncel kodda yeniden koş; raporda merge SHA belirt.

## STRIDE / TARA özeti

### S — Spoofing (kimlik sahteciliği)

| Tehdit | Yüzey | Kontrol | Test / kanıt |
|--------|--------|---------|----------------|
| Sahte BLE peer / radyo advertisement | BLE GATT, mesh relay | HELLO/nonce, imzalı ingest, röle kimliği `SecureRandom` (ANDROID_ID yok) | `scripts/android-relay-no-android-id.sh`; mesh loop guard |
| Sahte operatör oturumu | JWT + httpOnly cookie | `OperatorAuthGuard`, RBAC, tenant scope | `apps/api/test/auth-rbac.spec.ts`, `security-adim43.spec.ts` |
| Sahte sunucu receipt | Ingest yanıtı | Ed25519 `SERVER_ACCEPTED` imzası | `apps/api/test/ingest.spec.ts` (bozuk imza reddi) |

**Açık bulgu:** **SEC-RADIO-SPOOF-001** (HIGH) — fiziksel BLE kimlik bağlama laboratuvarı yok; simülasyon dışı kanıt `NOT_TESTED`.

### T — Tampering

| Tehdit | Yüzey | Kontrol | Test / kanıt |
|--------|--------|---------|----------------|
| Chunk/CRC/digest manipülasyonu | BLE v1 | CRC + SHA256 `TRANSFER_VERIFIED` | Android `BleTransferGateTest`, chaos digest |
| Ciphertext/metadata oynama | AEAD | ChaCha20-Poly1305 + AAD | `packages/contracts/fixtures/security/adversarial-crypto.json` + `adversarial-security.test.ts` |
| TTL/hop/copy flood | Mesh v2 | TTL, max hops, LRU dedup, copy cap | `adversarial-mesh-relay.json` (50× duplicate flood) |
| Bozuk zarf | protocol-v2 | `validateEnvelope`, JSON Schema | Schema adversarial fixtures |

### R — Repudiation

| Tehdit | Yüzey | Kontrol | Test / kanıt |
|--------|--------|---------|----------------|
| Operatör eylemi inkârı | Panel | `audit_logs`, `OPERATOR_SEEN` idempotent | `operator-case-detail.spec.ts` |
| Ingest tekrarı | POST /v1/ingest | `message_id` UNIQUE + idempotent receipt | `ingest.spec.ts` 100× replay |

### I — Information disclosure

| Tehdit | Yüzey | Kontrol | Test / kanıt |
|--------|--------|---------|----------------|
| Röle logunda SOS metni | Mesh relay | Opaque zarf, log snapshot prefix only | `mesh-relay-engine.test.ts`, `adim43_mesh_relay_log_never_contains_embedded_sos_plaintext` |
| API/operatör log PII | NestJS pino | Redact paths, request-id | `request-id-redaction.spec.ts` |
| Panel XSS | Web case detail | Kaçış + CSP başlıkları | Playwright XSS; `apps/web/next.config.js` CSP (**SEC-WEB-CSP-001 remediated**) |
| Envelope plaintext alanı | Ingest DTO | `ENVELOPE_SENSITIVE_FIELD` | `ingest.spec.ts` |

### D — Denial of service

| Tehdit | Yüzey | Kontrol | Test / kanıt |
|--------|--------|---------|----------------|
| Ingest/ auth flood | API | Rate limit servisleri | `ingest.spec.ts`, `security-adim43.spec.ts` (auth 429) |
| Mesh duplicate flood | protocol-v2 engine | Dedup LRU | `duplicateFlood` adversarial fixture |
| Aşırı büyük payload | Ingest | 413 `PAYLOAD_TOO_LARGE` | `ingest.spec.ts`; mesh motoru **SEC-MESH-SIZE-001** (16 KiB opaque cap, schema maxLength + TS/Kotlin doğrulayıcı) |

### E — Elevation of privilege

| Tehdit | Yüzey | Kontrol | Test / kanıt |
|--------|--------|---------|----------------|
| OPERATOR → ADMIN | Operator API | `RolesGuard` | `auth-rbac.spec.ts`, `security-adim43.spec.ts` |
| Cross-tenant vaka | Incident scope | `IncidentScopeService` fail-closed | RBAC + organization isolation testleri |
| CSRF cookie oturumu | State-changing POST | `OperatorCsrfGuard` + Origin allowlist | `security-adim43.spec.ts` |

## Sunucu kötüye kullanımı (server abuse)

- **Ingest:** rate limit, şema doğrulama, packet hash, TTL, idempotency (`ingest.spec.ts`).
- **Operatör:** auth rate limit, CSRF, RBAC (`security-adim43.spec.ts`).
- **AI worker:** tenant rate limit (`ai-worker.spec.ts`); outage ingest’i bloklamaz.

## Otomatik tarama bağlantısı (ücretli SAST yok)

| Araç | CI / yerel | Kanıt dosyası |
|------|------------|----------------|
| Secret scanner | CI job `secret-scan`; `verify.sh` 14–15 | `scripts/secret-scan.sh`, `reports/secret-scan.log` |
| Lint / typecheck (hafif SAST) | CI `verify`, `contracts` | `scripts/verify.sh` |
| Bağımlılık audit | Yerel `pnpm audit` (Dependabot dokunulmadı) | `docs/security/findings.csv` (açık critical/high) |
| Android SOS log hijyeni | `verify.sh` 22–24 | `android-sos-privacy-log.sh` |
| Cross-language crypto | CI `cross-language-contracts` | golden vector eşitliği |

**Not:** `pnpm audit` 2026-11-01 itibarıyla **7 critical / 31 high** transitive bulgu raporlar; production kapısı için **SEC-DEP-*** kayıtları `findings.csv`’de **açık** bırakıldı (yanlış “kapalı” etiket yok).

## Test envanteri (ADIM 43)

| Paket | Dosya | Adversarial fixture sayısı |
|-------|--------|----------------------------|
| `@sosmesh/contracts` | `src/security/adversarial-security.test.ts` | ≥30 (`fixtures/security/*.json`) |
| `@sosmesh/api` | `test/security-adim43.spec.ts` | auth RL, CSRF, RBAC, HTTP başlıkları |
| Mevcut | `ingest.spec.ts`, `auth-rbac.spec.ts`, `mesh-relay-engine.test.ts` | replay, imza, gizlilik |

## GEÇTİ ölçütü (master plan) — durum

| Ölçüt | Beklenen | Bu dal |
|-------|----------|--------|
| Critical risk = 0 | Kapalı veya remediated | **Karşılanmadı** — npm critical açık + bağımsız denetim yok → **PARTIAL** |
| High risk onaylı remediated | High’lar kapatılmış veya sahipli açık | Kısmen — CSP/API header remediated; deps/radio spoof açık |
| 30+ adversarial fixture | Koşan test | **PASS** (contracts suite) |
| Bağımsız denetim | İnsan denetimi | **NOT_TESTED** |

## Bulgular

Tam liste: [`findings.csv`](./findings.csv) — `id`, `severity`, `bileşen`, `remediation sahibi`, `durum`.

## İlgili dosyalar

- `docs/security/key-management.md` (ADIM 09)
- `packages/contracts/protocol-v2/README.md` (ADIM 40 mesh v2)
- `docs/tests/traceability.md` §43
