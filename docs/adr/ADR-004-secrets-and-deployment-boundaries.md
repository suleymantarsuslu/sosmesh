# ADR-004: Secrets ve Deployment Boundaries

**Durum:** Kabul Edildi  
**Tarih:** 2026-10-29  
**Kapsam:** ADIM 03 (Hackathon / Çekirdek)  
**İlgili:** ADR-001 (stack), ADIM 09 (kriptografi), ADIM 20 (Meta AI)

---

## Bağlam

SOSMesh hassas bilgiler içerir: Meta AI API anahtarı, database credentials, encryption keys. Mobil/web client'larda secret olmamalı; server-side secrets production'da güvenli yönetilmeli.

**Gereksinimler:**
- `MODEL_API_KEY` yalnızca backend/worker
- Mobil/web client'ta API key yok
- Ortam ayrımı: dev, staging, production
- Production deploy ve store işlemleri kullanıcı onayı

---

## Karar

### 1. Secret Tipleri ve Sınırları

| Secret Türü | Sahibi | Mobil/Web | Backend | Neden |
|-------------|--------|-----------|---------|-------|
| **MODEL_API_KEY** | Meta AI | ❌ | ✅ | Mobil/web client expose olur; yalnızca server-side worker |
| **DATABASE_URL** | PostgreSQL | ❌ | ✅ | DB direct access yalnızca backend |
| **ENCRYPTION_KEY** | E2E payload | ❌ | ✅ | Server public key ile encrypt; mobil yalnızca public key tutar |
| **JWT_SECRET** | Auth token | ❌ | ✅ | Token sign/verify yalnızca backend |
| **API_PUBLIC_KEY** | SOS envelope sign | ✅ | ✅ | Mobil verify için public key tutabilir (private key yalnızca server) |

**Kural:** Mobil/web client'ta **hiçbir private key veya API secret** olmamalı.

---

### 2. Ortam Ayrımı

#### Dev (Local)

**Konum:** `.env.local` (git'te yok)

```bash
# Database
DATABASE_URL=postgresql://postgres:dev@localhost:5432/sosmesh_dev

# Meta AI (Mock)
META_BASE_URL=http://localhost:3001/mock-meta
META_MODEL=mock-model
MODEL_API_KEY=dev-mock-key

# Redis (opsiyonel)
REDIS_URL=redis://localhost:6379

# Encryption (dev key)
ENCRYPTION_PUBLIC_KEY=base64(...)
ENCRYPTION_PRIVATE_KEY=base64(...)

# JWT
JWT_SECRET=dev-jwt-secret-32-chars
JWT_EXPIRES_IN=7d
```

#### Staging

**Konum:** Secret manager (GitHub Secrets / Cursor Cloud Agent Secrets)

```bash
DATABASE_URL=postgresql://user:pass@staging-db:5432/sosmesh_staging
META_BASE_URL=https://api.meta.ai/v1
META_MODEL=muse-spark-1.3
MODEL_API_KEY=<staging-meta-key>
ENCRYPTION_PRIVATE_KEY=<staging-private-key>
JWT_SECRET=<staging-jwt-secret>
```

#### Production

**Konum:** Secret manager + kullanıcı onayı

```bash
DATABASE_URL=<prod-db-connection-string>
META_BASE_URL=https://api.meta.ai/v1
META_MODEL=muse-spark-1.3
MODEL_API_KEY=<prod-meta-key>  # ⚠️ Kullanıcı onayı ile secret manager'dan inject
ENCRYPTION_PRIVATE_KEY=<prod-private-key>
JWT_SECRET=<prod-jwt-secret>
```

**Özel Kısıtlar:**
- **MODEL_API_KEY production değeri:** Kullanıcı onayı gerektirir (Cursor Dashboard → Secrets)
- **Database backup/restore:** Manuel onay
- **Store publish (Google Play, App Store):** Manuel onay

---

### 3. Secret Yönetimi

#### Lokal Geliştirme

**`.env.example` (repo'da):**

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/sosmesh_dev

# Meta AI (local mock server)
META_BASE_URL=http://localhost:3001/mock-meta
META_MODEL=mock-model
MODEL_API_KEY=dev-mock-key

# Encryption (dev keypair — NOT for production)
ENCRYPTION_PUBLIC_KEY=<base64-dev-public-key>
ENCRYPTION_PRIVATE_KEY=<base64-dev-private-key>

# JWT
JWT_SECRET=<32-char-random-string>
JWT_EXPIRES_IN=7d

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

**Kullanım:**
```bash
cp .env.example .env.local
# .env.local'i düzenle (gerçek dev credentials)
# .env.local .gitignore'da
```

#### CI/CD

**GitHub Actions:**

```yaml
env:
  DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
  MODEL_API_KEY: ${{ secrets.STAGING_META_API_KEY }}
  # ...
```

**Cursor Cloud Agent:**

```bash
# Cursor Dashboard → Cloud Agents → Secrets
# Repo-scoped secrets:
STAGING_META_API_KEY=<value>
PROD_META_API_KEY=<value>  # Yalnızca user onayı ile kullanılır
```

---

### 4. Mobil/Web Client Kısıtlamaları

#### Mobil (Android/iOS)

**Asla içermez:**
- `MODEL_API_KEY`
- `DATABASE_URL`
- `JWT_SECRET`
- Encryption private key

**İçerebilir:**
- API endpoint URL (`https://api.sosmesh.example/v1`)
- Encryption public key (envelope verify için)
- Demo mode flag (`IS_DEMO_MODE=true`)

**Örnek `local.properties` (Android):**

```properties
# API endpoint
API_BASE_URL=https://staging.sosmesh.example
# Public key for envelope verification
API_PUBLIC_KEY=<base64-public-key>
# Demo mode
IS_DEMO_MODE=false
```

#### Web (Next.js)

**Public Env Variables:**

```bash
# .env.production (public)
NEXT_PUBLIC_API_URL=https://api.sosmesh.example
NEXT_PUBLIC_WS_URL=wss://api.sosmesh.example/ws
```

**Private Env Variables:**

```bash
# .env (server-side only)
DATABASE_URL=<prod-db>
MODEL_API_KEY=<prod-meta-key>
JWT_SECRET=<prod-jwt>
```

**Kural:** `NEXT_PUBLIC_*` prefix'i browser'a expose olur; gizli anahtar asla `NEXT_PUBLIC_` kullanmaz.

---

### 5. Production Deployment Guard

**Manuel Onay Gerektiren İşlemler:**

| İşlem | Onay Gereksinimi | Neden |
|-------|------------------|-------|
| **MODEL_API_KEY set (prod)** | ✅ Kullanıcı onayı | Maliyet, kota riski |
| **DATABASE_URL set (prod)** | ✅ Kullanıcı onayı | Veri kaybı riski |
| **Google Play / App Store publish** | ✅ Kullanıcı onayı | Public release |
| **Database backup/restore** | ✅ Kullanıcı onayı | Veri bütünlüğü |
| **Secret rotation** | ✅ Kullanıcı onayı | Downtime riski |

**Staging Deploy:**
- Otomatik (CI/CD)
- Test secrets kullanır

**Production Deploy:**
- CI/CD **"approval gate"** ile
- Kullanıcı Slack/email onayı sonrası deploy başlar

---

### 6. Secret Rotation

**Politika:**
- **Prod secrets:** 90 günde bir rotate (JWT, encryption key)
- **Meta API key:** Vendor rotation policy'ye uyar
- **Database credentials:** Managed service auto-rotation

**Rotation Süreci:**

1. **Yeni secret oluştur** (ör. `JWT_SECRET_NEW`)
2. **Backend dual-mode:** Hem eski hem yeni secret'ı kabul et
3. **Mobile/web client güncelle** (yeni token al)
4. **Eski secret'ı kaldır** (grace period: 7 gün)

---

## Alternatifler

### Tüm Secrets CI/CD Env Variables

**Avantajlar:**
- Basit, her platform CI'da tanımlı

**Dezavantajlar:**
- **Güvenlik riski:** CI log'larında leak olabilir
- **Rotation zor:** Her rotation CI'da manuel güncelleme

**Sonuç:** Secret manager (HashiCorp Vault, AWS Secrets Manager, GitHub Secrets) tercih edilir

### Mobil Client'ta API Key

**Neden Reddedildi:**
- APK/IPA decompile edilebilir → API key expose olur
- Rate limit bypass riski
- Abuse potansiyeli (ör. spam SOS)

**Sonuç:** Backend proxy pattern — mobil client yalnızca public API'ye istek yapar, backend Meta AI'yi çağırır

---

## Sonuçlar

### Pozitif
- **Güvenli secret yönetimi:** Prod secrets yalnızca server-side
- **Mobil/web client temiz:** Hiçbir private key yok
- **Ortam ayrımı:** Dev/staging/prod açık sınırlı
- **Production guard:** Kullanıcı onayı kritik işlemler için zorunlu

### Negatif
- **Secret manager bağımlılığı:** GitHub Secrets / Cursor Secrets gerekli
- **Rotation karmaşıklığı:** Dual-mode backend, grace period yönetimi
- **Onay gecikmeleri:** Production deploy kullanıcı onayı beklerse gecikebilir

### Riskler
- **Secret leak (CI log):** CI'da secret echo edilirse log'da görünür
  - **Mitigation:** CI'da `set +x`, secret masking
- **Key rotation downtime:** Eski key hemen kaldırılırsa client'lar fail olur
  - **Mitigation:** Grace period (7 gün dual-mode)
- **MODEL_API_KEY abuse:** Prod anahtarı leak olursa kota tükenir
  - **Mitigation:** Rate limit (API gateway), alert (Datadog), rotation

---

## Deployment Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ PRODUCTION (kullanıcı onayı gerekli)                        │
├─────────────────────────────────────────────────────────────┤
│ - MODEL_API_KEY (prod)                                      │
│ - DATABASE_URL (prod)                                       │
│ - ENCRYPTION_PRIVATE_KEY (prod)                             │
│ - Google Play / App Store publish                           │
│ - Database backup/restore                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STAGING (otomatik CI/CD)                                    │
├─────────────────────────────────────────────────────────────┤
│ - Staging secrets (GitHub Secrets)                          │
│ - Test database                                             │
│ - Mock Meta AI (veya staging key)                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DEV (local .env.local)                                      │
├─────────────────────────────────────────────────────────────┤
│ - Local PostgreSQL                                          │
│ - Mock Meta AI                                              │
│ - Dev keypair (NOT production)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## İlgili Kararlar

- **ADR-001:** Stack (backend NestJS, env validation)
- **ADR-002:** Native mobile (client'ta secret yok)
- **ADR-003:** Contracts (encryption public key mobil'de)

---

## Referanslar

- Master Plan §09: Kriptografi ve yerel mahremiyet
- Master Plan §16: ENV şablonu
- Master Plan §20: Meta AI servis entegrasyonu
- Master Plan §54: Backend deployment ve environment yönetimi
- OWASP: Secure Secret Storage
