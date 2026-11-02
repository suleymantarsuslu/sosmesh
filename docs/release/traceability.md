# SOSMesh release traceability (ADIM 56)

**Kaynak:** `docs/handover/status.json` + `docs/tests/m0-acceptance.feature` + GEÇTİ ölçütleri.

**Kural:** Fiziksel cihaz, MacBook/Xcode, mağaza veya hukuki inceleme kanıtı gerektiren maddeler **asla PASS sayılmaz**; `verification_status` status.json ile uyumludur.

**Üretim:** `node scripts/release/generate-traceability.mjs` — 2026-11-02T18:39:47.663Z

**Kayıt sayısı:** 88 (58 ADIM + M0 senaryoları + GEÇTİ ölçütleri)

## Makine okunur çıktı

- [`traceability.json`](./traceability.json)

## Özet tablo (ADIM 01–58)

| ID | Durum | Test / kanıt (kısa) |
| --- | --- | --- |
| ADIM-01 | **PASS** | 9 desen gizlilik taraması + Grok bağımsız token/secret atama taraması exit=1 (bulgu yok), negatif test yakaladı, Grok→Cursor cloud agent launch/reply/rapor yolu çalıştı |
| ADIM-02 | **PASS** | 24 senaryo (@cucumber/gherkin parse başarılı), Grok bağımsız e-posta/telefon/koordinat/anahtar taraması 0 bulgu |
| ADIM-03 | **PASS** | (doküman kanıtı) |
| ADIM-04 | **ACCEPTED_WITH_DEBT** | Kullanıcı kararı 2026-10-29, mobil/web kanıtları bağımsız denetlendi |
| ADIM-05 | **PASS** | (doküman kanıtı) |
| ADIM-06 | **PASS** | PR #16: https://github.com/suleymantarsuslu/sosmesh/pull/16, scripts/check-no-skips.js |
| ADIM-07 | **PASS** | PR #18: https://github.com/suleymantarsuslu/sosmesh/pull/18, packages/contracts-kotlin |
| ADIM-08 | **PASS** | (doküman kanıtı) |
| ADIM-09 | **PASS** | Golden vectors TS/Kotlin/Swift 3+3+3, PR #20: https://github.com/suleymantarsuslu/sosmesh/pull/20 |
| ADIM-10 | **PASS** | (doküman kanıtı) |
| ADIM-11 | **PASS** | 100-transfer 36 success / 64 failed, scripts/mesh-sim-golden.sh |
| ADIM-12 | **PARTIAL** | Gerçek Android cihaz / Android 12-14-16 enstrümantasyon: NOT_TESTED |
| ADIM-13 | **PARTIAL** | Compose/Robolectric unit tests: outbox enqueue, forbidden copy, i18n parity, docs/tests/android-talkback-script.md NOT_TESTED |
| ADIM-14 | **PARTIAL** | Gerçek 2 cihaz keşif/GATT: NOT_TESTED, docs/tests/android-radio.md prosedür + OEM şablon |
| ADIM-15 | **PARTIAL** | AndroidGattClientPort/ServerPort: GATT write/notify (ADIM 14), BleTransferSimulatedTest: senderCompleted_onlyAfterTransferVerified; paket kaybı/resume simülasyonu |
| ADIM-16 | **PARTIAL** | Ekran kapalı / reboot / background-kill / enerji ölçümü: NOT_TESTED, RelayScreen/ViewModel: yalnız sayı/meta; OS kısıt metinleri |
| ADIM-17 | **PARTIAL** | Gate H 2026-11-01: apps/api jest 91/91 (docs/handover/evidence/gate-h/adim17-deferred-api-tests.txt), Gate H 2026-11-01: mesh-sim-mutation + mutation-sentinel (docs/handover/evidence/gate-h/*.txt) |
| ADIM-18 | **PASS** | ADR-011 envelope locationStatus (UNKNOWN/MANUAL/GPS) + ingest envelope-location.ts, apps/api/test/ingest.spec.ts |
| ADIM-19 | **PARTIAL** | API: POST /v1/ingest/batch, GET /v1/operator/events (SSE Accept + ?after= polling), operator_feed_events, apps/api/test/sync-events.spec.ts; JVM: ServerReceiptVerifierTest, RelayOfflineOnlineIntegrationTest, RelayUploadExecutorTest (409) |
| ADIM-20 | **PARTIAL** | Canlı Meta chat/completions smoke: denetçi 2026-11-01 (sentetik TR fixture, 200/stop/şema; ~1.9k token/istek), apps/api/src/ai/evals/fixtures.ts (32 TR/EN fixtures) |
| ADIM-21 | **PARTIAL** | API auth-rbac.spec.ts: 401/403/scope 404, Gate H 2026-11-01: reports/operator-dashboard-{390,768,1440}.png Playwright PASS |
| ADIM-22 | **PARTIAL** | GET /v1/operator/cases + /cases/:incidentId (OperatorAuthGuard + IncidentScopeService); operator-cases.spec.ts 401/scope, Gate H 2026-11-01: pnpm test:a11y:web 22/22; verify.sh 24/24 EXIT=0 |
| ADIM-23 | **PARTIAL** | GET /v1/operator/cases/:id/detail → idempotent OPERATOR_SEEN (operator_view) + audit; operator-case-detail.spec.ts, PATCH review-status + POST corrections/ai-override (version 409); Incident.reviewStatus + optimistic version |
| ADIM-24 | **NOT_TESTED** | apps/android RelayUploadExecutorTest http500, apps/web map/config production guard testleri |
| ADIM-25 | **PARTIAL** | demo/storyboard.md (video henüz yok), docs/architecture/requirements-map.md |
| ADIM-26 | **PARTIAL** | Cases 3-col + tablet split; dashboard bento; axe AA 0 violations (test:a11y:web 16/16), Operatör shell: org header, incident switcher, saved views, theme TR/EN, mobile drawer |
| ADIM-27 | **PARTIAL** | ERTELENDI: mutation/geniş ekran görüntüleri PASS sayılmadı, apps/api/src/coordination (teams/resources/tasks, optimistic version 409, audit_logs) |
| ADIM-28 | **PARTIAL** | GET /v1/operator/notifications, /activity, /activity/export (role guard), Push/email gerçek sağlayıcı: in-app worker only (NOT_TESTED prod delivery) |
| ADIM-29 | **PARTIAL** | Gradle :core:ble/:core:platform testDebugUnitTest + ktlintCheck EXIT=0 (review VM, JDK 17 bytecode, ANDROID_HOME=/opt/android-sdk); tam monorepo CI android-gradle job, SosFlowScreen: konum tazelik rozeti (LocationFreshness); birincil/ikincil CTA ayrımı (continue pill, express ana ekranda) |
| ADIM-30 | **PARTIAL** | Gerçek cihaz pil ölçümü / 3+ OEM / BLE: NOT_TESTED, Gradle :core:ble/:core:platform testDebugUnitTest + ktlintCheck EXIT=0 (review VM); tam monorepo CI android-gradle job PR #44 |
| ADIM-31 | **PARTIAL** | Fiziksel imzalama/simulator UI NOT_TESTED, apps/ios/SOSMesh.xcodeproj + SwiftUI tab iskelet (SOS/Status/Relay/Settings) |
| ADIM-32 | **PARTIAL** | apps/ios/CoreBLE central/peripheral + GATT UUID parity, docs/tests/cross-platform-ble.md |
| ADIM-33 | **PARTIAL** | Fiziksel video/trace NOT_TESTED, UIBackgroundModes bluetooth-central/peripheral in Info.plist |
| ADIM-34 | **PARTIAL** | VoiceOver/Dynamic Type fiziksel: NOT_TESTED, docs/compat/cross-platform-matrix.csv (fiziksel satırlar NOT_TESTED) |
| ADIM-35 | **PARTIAL** | Wear emulator / gerçek saat: NOT_TESTED (B-04), apps/android/core/wear-companion Data Layer yolları /sosmesh/v1/sos/create + phone_ack |
| ADIM-36 | **PARTIAL** | Paired/unpaired gerçek cihaz, tile/complication: NOT_TESTED / ERTELENDİ, docs/watches/wear-policy.md; apps/wearos/state-sync/README.md |
| ADIM-37 | **PARTIAL** | SOSMeshCore/WatchCompanion wire, offline queue, ingress idempotency, apps/ios/SOSMesh/Companion PhoneWatchSessionManager + PhoneWatchSosIngress → outbox origin=watch_os |
| ADIM-38 | **PARTIAL** | Gerçek saat komplikasyon tap / phone off: NOT_TESTED (B-04), apps/watchos/SOSMeshWatchWidgets WidgetKit complication + WatchRetryPolicy backoff |
| ADIM-39 | **PARTIAL** | WatchOfflineHelpView + phoneNotReachableCopy (TR/EN), docs/watches/capability-matrix.md + WatchCapabilityMatrix.swift |
| ADIM-40 | **PARTIAL** | 3 fiziksel Android zinciri / link drop / OEM: NOT_TESTED, apps/android/mesh-v2: MeshV2RelayCoordinator, MeshForwardQueue, MeshRouteSelector, MeshPeerAckSemantics |
| ADIM-41 | **PARTIAL** | 3 cihaz foreground/locked/force-quit fiziksel: NOT_TESTED, MeshRelayEngineCrossLanguageTests: relay-engine-cases.json PASS (Swift PM / CI) |
| ADIM-42 | **PARTIAL** | AdaptiveRadioPlanner (Kotlin + Swift) + packages/contracts/radio-planner/vectors/radio-planner-cases.json, AdaptiveRadioPlannerTest / AdaptiveRadioPlannerTests + internal AdaptiveRadioPlannerTesting mutation |
| ADIM-43 | **PARTIAL** | apps/api/test/security-adim43.spec.ts (CSRF, RBAC, rate limit 429, HTTP başlıkları), docs/security/findings.csv (critical npm remediated; SEC-RADIO-SPOOF-001 açık) |
| ADIM-44 | **PARTIAL** | apps/api/src/privacy/* erase/export/retention + audit-redaction.util.ts, apps/api/test/privacy-adim44.spec.ts (RBAC, IDOR, CSRF, export audit redaction, erase cascade, retention purge, seed sentetik guard) |
| ADIM-45 | **PARTIAL** | apps/api/src/ai/evals (113 sentetik fixture, mock eval-runner, operator correction capture), apps/api/src/ai/schemas/safe-fallback.ts, deidentify-plaintext.ts, ai-metrics.ts, incident token budget |
| ADIM-46 | **PARTIAL** | apps/api/src/recommendation (matching-engine, rationale guards, REST), apps/api/test/recommendation-adim46.spec.ts |
| ADIM-47 | **PARTIAL** | Android OutboxAdim47CapacityTest + Swift TransportOutboxTests 1k/TTL, apps/api/prisma/migrations/20261101220000_adim47_perf_indexes |
| ADIM-48 | **PASS** | Bağımsız denetim PR #58: pnpm -r build/test, verify.sh 24/24, mutation redaction test kırmızı kanıtı, apps/api/src/observability/* OTEL (varsayılan kapalı), /metrics Bearer METRICS_SCRAPE_AUTH, structured redacted events |
| ADIM-49 | **PARTIAL** | apps/api/src/disaster/disaster-readonly.middleware.ts (default off unless SOSMESH_DISASTER_READ_ONLY_MODE=true), apps/api/test/backup-adim49.spec.ts |
| ADIM-50 | **PARTIAL** | Bağımsız denetim: merge origin/main 97d0eee; ADIM 43 zinciri main'de, MobileNavDrawer dialog/aria-modal; mobil menü E2E 390px |
| ADIM-51 | **PARTIAL** | Gerçek cihaz BLE/Doze/24h smoke + Play upload: NOT_TESTED / BLOCKED_APPROVAL, ReleaseBuildConfigGuardTest + android-release-buildconfig-scan.sh |
| ADIM-52 | **PARTIAL** | Fiziksel iPhone/Watch + TestFlight kurulum: NOT_TESTED, apps/ios/Config/Release-{Demo,Staging,Prod}.xcconfig |
| ADIM-53 | **PARTIAL** | Play upload / imzalı artifact: BLOCKED_APPROVAL (B-06), Tile/complication: yok (bilinçli; wearos.md) |
| ADIM-54 | **PARTIAL** | .github/workflows/deploy-container-smoke.yml (ubuntu-latest, fork guard), Prod deploy/DNS/cert/public push: BLOCKED_APPROVAL |
| ADIM-55 | **NOT_STARTED** | (doküman kanıtı) |
| ADIM-56 | **PARTIAL** | CHANGELOG.md, docs/release/qa-summary.json |
| ADIM-57 | **PARTIAL** | SECURITY.md, apps/web/app/(operator)/operator/(panel)/help/page.tsx |
| ADIM-58 | **NOT_STARTED** | (doküman kanıtı) |

## M0 senaryoları (@device-required → NOT_TESTED)

- **M0-U1-afetzede-offline-sos-olu-turur** (NOT_TESTED): Afetzede offline SOS oluşturur
- **M0-U1-konum-izni-olmadan-sos-olu-turma** (NOT_TESTED): Konum izni olmadan SOS oluşturma
- **M0-U2-g-n-ll-r-le-ble-ile-sos-al-r** (NOT_TESTED): Gönüllü röle BLE ile SOS alır
- **M0-U2-r-le-ifreli-payload-g-rmez** (NOT_TESTED): Röle şifreli payload'ı görmez
- **M0-U2-bluetooth-kapal-yken-r-le-al-maz** (NOT_TESTED): Bluetooth kapalıyken röle çalışmaz
- **M0-U2-r-le-internete-ula-nca-sunucuya-upload-yapar** (NOT_TESTED): Röle internete ulaşınca sunucuya upload yapar
- **M0-M0-i-ki-android-ile-m0-u-tan-uca-ak** (NOT_TESTED): İki Android ile M0 uçtan uca akış
- **M0-M0-duplicate-paket-tek-vaka-olu-turur-idempotency** (PARTIAL): Duplicate paket tek vaka oluşturur (idempotency)
- **M0-M0-offline-yolda-meta-api-a-r-s-yap-lmaz** (PARTIAL): Offline yolda Meta API çağrısı yapılmaz
- **M0-U3-operat-r-panelde-vaka-g-r-nt-ler** (PARTIAL): Operatör panelde vaka görüntüler
- **M0-U3-yetkisiz-rol-vaka-g-remez** (PARTIAL): Yetkisiz rol vaka göremez
- **M0-U3-meta-ai-sos-u-s-n-fland-r-r-yaln-zca-destekleyic** (PARTIAL): Meta AI SOS'u sınıflandırır (yalnızca destekleyici öneri)
- **M0-U3-meta-api-anahtar-yoksa-ai-ad-m-atlan-r** (PARTIAL): Meta API anahtarı yoksa AI adımı atlanır
- **M0-U3-meta-ai-timeout-veya-5xx-hatas** (PARTIAL): Meta AI timeout veya 5xx hatası
- **M0-U3-ai-hal-sinasyon-a-k-a-s-ylenmeyeni-uydurma** (PARTIAL): AI halüsinasyon — açıkça söylenmeyeni uydurma
- **M0-U4-saat-watch-offline-sos-u-e-le-mi-telefona-aktar-** (NOT_TESTED): Saat (watch) offline SOS'u eşleşmiş telefona aktarır
- **M0-U4-telefon-eri-ilemezken-saat-durumu-do-ru-g-sterir** (NOT_TESTED): Telefon erişilemezken saat durumu doğru gösterir
- **M0-U4-saat-ba-ms-z-mesh-r-lesi-de-ildir** (NOT_TESTED): Saat bağımsız mesh rölesi değildir
- **M0-U5-i-zin-reddi-ak** (NOT_TESTED): İzin reddi akışı
- **M0-U5-api-429-rate-limit** (PARTIAL): API 429 rate limit
- **M0-U5-api-500-internal-server-error** (PARTIAL): API 500 Internal Server Error
- **M0-negative-demo-sim-lasyon-a-k-a-etiketlenir** (PARTIAL): Demo/simülasyon açıkça etiketlenir
- **M0-negative-112-uyar-s-onboarding-de-zorunlu** (PARTIAL): 112 uyarısı onboarding'de zorunlu
- **M0-negative-yasak-etiketler-ui-da-g-r-nmez** (PARTIAL): Yasak etiketler UI'da görünmez

## GEÇTİ ölçütleri

- **GECTI-ANDROID-M0M1-DEVICE** (NOT_TESTED): APK gerçek cihazda M0+M1 akışını çalıştırır — `docs/release/android.md`
- **GECTI-IOS-DEVICE** (NOT_TESTED): Gerçek cihaz iş akışı kanıtlı — `docs/release/ios.md`
- **GECTI-WEAROS-E2E** (NOT_TESTED): Gerçek saat uçtan uca — `docs/release/wearos.md`
- **GECTI-DEPLOY-STAGING-PROD** (PARTIAL): Staging çalışır + prod onaylı — `docs/runbooks/deploy.md`
- **GECTI-THREAT-MODEL** (PARTIAL): STRIDE + bağımsız denetim GEÇTİ — `docs/security/threat-model.md`
- **GECTI-DEMO-PROD-SEPARATION** (PARTIAL): Mock/demo production yapılandırmasında kapalı — `docs/architecture/requirements-map.md` — platform: {"web_isE2eMock_behavioral":"PASS","android_prod_buildconfig_behavioral":"NOT_TESTED"}

## CI iş adları (Linux doğrulama)

- `Verify Quality Gates` → `bash scripts/verify.sh`
- `Android Gradle Build`, `Cross-Language Contract Tests`, `Load smoke (k6 profile 100)`, `Secret Scan`

