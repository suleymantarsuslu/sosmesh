#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { buildStepTableMarkdown } from './verify-handover.mjs';

const status = JSON.parse(readFileSync('docs/handover/status.json', 'utf8'));
const table = buildStepTableMarkdown(status.steps);
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

let sumSample =
  '066eb3dac305e6cb6fd2a23ac63c76189bcef4a78b3d5fe3adff9a4cd1d4d176  apps/api/dist/ai/ai.constants.d.ts';
try {
  sumSample = readFileSync('/tmp/sosmesh-worktree-adim58/docs/release/SHA256SUMS', 'utf8')
    .split('\n')
    .slice(0, 3)
    .join('\n');
} catch {
  /* illustrative sample only; file is not committed */
}

const report = `# SOSMesh ADIM 58 — Operasyonel handover ve tamamlanma raporu

**Tarih (UTC):** 2026-11-02  
**Dal:** \`${branch}\`  
**HEAD:** \`${sha}\`  
**Kaynak (tek doğruluk):** [\`docs/handover/status.json\`](status.json), [\`docs/release/traceability.json\`](../release/traceability.json)  
**Proje tamamlanma:** **NOT_COMPLETE** — zorunlu kapıların tamamı PASS + gerçek kanıt değil; bu rapor **PARTIAL** handover’dır. *“Tamamlandı”* yalnızca tüm gerekli kapılar gerçek kanıtla PASS olduğunda söylenebilir; **şu an sağlanmıyor**.

**Kırmızı çizgi:** SOSMesh resmî **112 / acil servis yerine geçmez**. Offline BLE mesajı AI olmadan çalışmalıdır; gönüllü röle hassas SOS metnini görmez; peer ACK operatör okundu değildir.

---

## Operasyonel uç noktalar (dürüst)

| Kaynak | Değer |
|--------|--------|
| Public demo URL | **YOK — deploy onay bekliyor** |
| API health URL (staging/prod) | **YOK — deploy onay bekliyor** |
| Operatör paneli (public) | **YOK — deploy onay bekliyor** |
| Grafana / Prometheus (prod) | **YOK — deploy onay bekliyor** (şablon: \`infra/monitoring/\`) |
| İmzalı mağaza artifact | **YOK — imzalama / mağaza onayı bekliyor** |

---

## ADIM 01–58 ilerleme tablosu

Durum sütunu **yalnızca** \`status.json\` ile aynıdır; yükseltme yoktur.

${table}

### Açık PR (PENDING_MERGE)

| ADIM | PR | Not |
|------|-----|-----|
| — | [PR #68](https://github.com/suleymantarsuslu/sosmesh/pull/68) | MacBook self-hosted CI (\`SOSMESH_MAC_RUNNER=on\`) — **henüz merge değil** |

**Main’e merge edildi (PR head SHA → merge commit):**

| ADIM | PR | PR head (merged) | Merge commit (main) |
|------|-----|------------------|---------------------|
| 49 | [#59](https://github.com/suleymantarsuslu/sosmesh/pull/59) | \`d42633201280\` | \`8989ae26b68e\` |
| 50 | [#53](https://github.com/suleymantarsuslu/sosmesh/pull/53) | \`c0c6681db2f8\` | \`70594b3a037e\` |
| 56 | [#66](https://github.com/suleymantarsuslu/sosmesh/pull/66) | \`07dc3d2dd38a\` | \`54f25c8029ef\` |
| 57 | [#65](https://github.com/suleymantarsuslu/sosmesh/pull/65) | \`d0dde07728c1\` | \`17bbab7bed7d\` |

### CI / runner notu

- Varsayılan CI: GitHub Actions **GitHub-hosted** runner (\`SOSMESH_CI_RUNNER=github\`, repo değişkeni). ADIM 49 \`backup-restore-drill\` **PASS** on hosted run [41534348548](https://github.com/suleymantarsuslu/sosmesh/actions/runs/41534348548).
- Swift / Android Gradle / iOS archive: yalnızca \`SOSMESH_MAC_RUNNER=on\` iken **self-hosted MacBook** runner’da — [PR #68](https://github.com/suleymantarsuslu/sosmesh/pull/68) (**PENDING_MERGE**); **mobil CI PASS iddiası yok**.
- **NOT_TESTED (handover):** \`docker compose\` smoke, Firefox/WebKit tam matrix (CI kapsamı sınırlı), fiziksel cihaz / BLE saha kanıtı.

---

## Blokaj listeleri

### Fiziksel cihaz / platform (BLOCKED_DEVICE / NOT_TESTED)

- BLE 2× Android M0 (ADIM 24 **NOT_TESTED**, B-02)
- Android 12–16 saha / Doze / arka plan (ADIM 12–16, 42, 51 **PARTIAL**)
- iPhone / MacBook Xcode archive (B-03, B-13; ADIM 52 **PARTIAL**)
- watchOS / Wear OS gerçek saat (B-04; ADIM 35–39, 53 **PARTIAL**)
- TalkBack / VoiceOver tam akış (ADIM 13 **PARTIAL**; ADIM 50 manuel ekran okuyucu **NOT_TESTED**)
- Ekran okuyucu manuel rapor: **NOT_TESTED**

### Sır / yapılandırma (BLOCKED_SECRET)

- \`MODEL_API_KEY\` prod doğrulama (B-05)
- \`METRICS_SCRAPE_AUTH\` prod değeri (ADIM 48)
- Yedekleme şifreleme anahtarı / secret manager (ADIM 49 **PARTIAL** — CI drill PASS; prod/staging restore NOT_TESTED)
- Prod ingest / receipt anahtarları dağıtımı

### Onay / hukuk / mağaza (BLOCKED_APPROVAL)

- Apple imzalama, TestFlight, App Store review (B-06; ADIM 52)
- Google Play yükleme / inceleme (ADIM 51, 53)
- Hukuki / KVKK-GDPR inceleme (ADIM 44, 57 checklist **NOT_TESTED**)
- Destek iletişim kanalı prod (\`TODO_APPROVAL\`, \`DESTEK_*_TBD\`)
- Saha pilotu (ADIM 55 **NOT_STARTED**)
- Staging / prod deploy, DNS, TLS (ADIM 54 **PARTIAL**)
- AI harcama limiti prod (B-07; ADIM 20 **PARTIAL**)
- Gerçek model eval prod (ADIM 45 sentetik/mock ağırlıklı)

### npm / tedarik zinciri

- \`qa-summary.json\` → npm **high** audit bulguları (owner **TBD**)

---

## Açık riskler

| ID | Owner | Etki | Sonraki eylem |
|----|-------|------|----------------|
| R-01 | Kullanıcı | M0 sahada kanıtlanmadan ürün iddiası zayıf | 2 Android ile ADIM 24 prosedürü + video |
| R-02 | Kullanıcı | Prod AI maliyeti kontrolsüz | B-07 limit onayı + secret manager |
| R-03 | TBD | Yedekten dönüş kanıtı yok | PR #59 merge sonrası restore drill |
| R-04 | Kullanıcı | Mağaza reddi / imza | Play + App Store hazır komutlar (onaylı) |
| R-05 | TBD | npm high CVE | Patch planı (Dependabot’a dokunulmadı) |
| R-06 | Kullanıcı | Operasyonel körlük | Staging deploy + health + metrics onayı |

---

## Operatör onboarding checklist

1. [\`docs/00-access-inventory.md\`](../00-access-inventory.md)
2. [\`docs/runbooks/deploy.md\`](../runbooks/deploy.md) — prod **NOT EXECUTED**
3. [\`docs/runbooks/\`](../runbooks/) — ADIM 48 runbook’ları
4. [\`docs/release/release-readiness.md\`](../release/release-readiness.md)
5. [\`docs/user/kullanici-rehberi-tr.md\`](../user/kullanici-rehberi-tr.md)
6. Yerel panel: \`pnpm --filter @sosmesh/web dev\` (public URL **YOK**)
7. \`METRICS_SCRAPE_AUTH\` prod — **onay bekliyor**
8. **112 uyarısı** onboarding metinlerinde zorunlu

## On-call checklist

1. Yerel health: \`curl -sS http://127.0.0.1:3001/health\` (prod URL **YOK**)
2. \`infra/monitoring/prometheus/alerts.yml\`
3. AI worker stuck alert → runbook
4. Rollback: \`docs/runbooks/deploy.md\` — prod **NOT EXECUTED**
5. Destek: **TODO_APPROVAL** — kullanıcı yapılandırmalı

---

## Onay bekleyen eylemler

Komutlar **hazır**, **NOT EXECUTED / UYGULANMADI** — **kullanıcı onayı şart**.

### Staging deploy (NOT EXECUTED)

\`\`\`bash
export DEPLOY_ENV=staging
export DATABASE_URL='postgresql://USER@HOST:5432/sosmesh_staging'
# JWT signing: secret manager entry documented in .env.example (name JWT_SECRET)
# docker compose -f infra/deploy/compose/docker-compose.staging.yml up -d --build
\`\`\`

### Production deploy (NOT EXECUTED)

\`\`\`bash
# GitHub Environment protection + manual approval required
# gh workflow run deploy-prod.yml --ref main
\`\`\`

### DNS / TLS (NOT EXECUTED)

\`\`\`bash
# api.example.com -> LB_IP_PLACEHOLDER (user-owned DNS zone)
\`\`\`

### Mağaza (NOT EXECUTED)

\`\`\`bash
# Play AAB upload; apps/ios/scripts/archive-export.sh for TestFlight
\`\`\`

### Anahtar rotasyonu (NOT EXECUTED)

\`\`\`bash
# JWT_SECRET, METRICS_SCRAPE_AUTH, MODEL_API_KEY — secret manager only
\`\`\`

### AI prod (NOT EXECUTED)

\`\`\`bash
# Enable after B-07 spend cap approval; set Meta provider key in secret manager (env name MODEL_API_KEY)
\`\`\`

---

## Copy-paste smoke komutları

\`\`\`bash
corepack enable && corepack prepare pnpm@9.0.0 --activate
pnpm install --frozen-lockfile
pnpm -r build
bash scripts/smoke.sh
bash scripts/secret-scan.sh
node scripts/release/verify-handover.mjs
\`\`\`

---

## Bağımsız temiz checkout (agent koşusu)

\`\`\`bash
git worktree add /tmp/sosmesh-worktree-adim58 <BRANCH_OR_SHA>
cd /tmp/sosmesh-worktree-adim58
corepack enable && corepack prepare pnpm@9.0.0 --activate
pnpm install --frozen-lockfile
pnpm -r build
bash scripts/smoke.sh
bash scripts/release/checksums.sh
\`\`\`

**2026-11-02 UTC (worktree HEAD \`98e4e0c0fafa8c6b582ffb3040c2bd8b4d0f74ac\`, taban merge sonrası):**

| Adım | Exit |
|------|------|
| \`pnpm install --frozen-lockfile\` | 0 |
| \`pnpm -r build\` | 0 |
| \`bash scripts/smoke.sh\` (build öncesi) | 1 |
| \`bash scripts/smoke.sh\` (build sonrası) | 0 |
| \`bash scripts/release/checksums.sh\` | 0 |

Push sonrası:

\`\`\`bash
git clone https://github.com/suleymantarsuslu/sosmesh.git /tmp/sosmesh-clean
cd /tmp/sosmesh-clean && git fetch origin cursor/adim-58-handover-03c7 && git checkout cursor/adim-58-handover-03c7
\`\`\`

---

## Artifact checksum kanıtı (ADIM 56)

\`docs/release/SHA256SUMS\` ve \`docs/release/sbom.cdx.json\` **repoda commit edilmez** — \`bash scripts/verify.sh\` çalıştırıldığında yerelde üretilir (**imzalı release artifact değil**).

\`\`\`bash
pnpm -r build && bash scripts/release/checksums.sh && sha256sum -c docs/release/SHA256SUMS
bash scripts/release/sbom.sh
\`\`\`

Örnek satır formatı (worktree koşusu; hashler makine/build’e göre değişir):

\`\`\`
${sumSample}
...
\`\`\`

---

## Gate H ek kanıt

[\`docs/handover/evidence/gate-h/\`](evidence/gate-h/) — ADIM 24 **NOT_TESTED** değişmedi.

---

## ADIM 58

| Alan | Değer |
|------|--------|
| Handover | **PARTIAL** |
| Doğrulama | \`scripts/release/verify-handover.mjs\` |
| Proje tamamlanma iddiası | **Hayır** (\`project_completion.status=NOT_COMPLETE\`) |
`;

writeFileSync('docs/handover/final-report.md', report);
console.log('Wrote docs/handover/final-report.md', sha);
