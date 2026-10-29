# Getting Started with SOSMesh Development

This guide walks you through setting up the SOSMesh monorepo for local development.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Running the Stack](#running-the-stack)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required

- **Node.js** 20.0.0 or higher ([download](https://nodejs.org/))
- **pnpm** 8.0.0 or higher
  ```bash
  npm install -g pnpm
  ```
- **Git** for version control

### Optional (Recommended)

- **Docker Desktop** for PostgreSQL and Redis containers ([download](https://www.docker.com/products/docker-desktop))
- **VS Code** with recommended extensions:
  - ESLint
  - Prettier
  - EditorConfig for VS Code
  - Prisma

### Platform-Specific (Mobile Development)

- **Android Development:**
  - Android Studio Hedgehog+ (2023.1.1+)
  - Android SDK 34+
  - Kotlin plugin
  - Android device or emulator

- **iOS/watchOS Development (macOS only):**
  - Xcode 15+
  - iOS 17+ SDK
  - watchOS 10+ SDK
  - iOS Simulator or physical device

---

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd sosmesh-monorepo
```

### 2. Run Bootstrap Script

The bootstrap script will:
- Check Node.js and pnpm versions
- Install all workspace dependencies
- Create `.env` from template
- Verify Docker availability

```bash
pnpm bootstrap
# or manually: bash scripts/bootstrap.sh
```

### 3. Configure Environment

Edit `.env` with your configuration:

```bash
# Copy template (already done by bootstrap)
cp .env.example .env

# Edit with your preferred editor
vim .env
# or
code .env
```

**Important variables:**

| Variable | Description | Required for M0 |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes |
| `MODEL_API_KEY` | Meta Llama API key | ✅ Yes |
| `JWT_SECRET` | JWT signing secret | ✅ Yes (use strong value in prod) |
| `REDIS_URL` | Redis connection string | ❌ Optional |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key | ❌ Future |
| `APNS_KEY_ID` | Apple Push Notification key | ❌ Future |

**Getting Meta Llama API Key:**
1. Visit https://developers.facebook.com/docs/llama-api/
2. Create a Meta developer account
3. Generate an API key
4. Add to `.env`: `MODEL_API_KEY=your_key_here`

### 4. Start Infrastructure (Option A: Docker)

```bash
# Start PostgreSQL + Redis
docker compose up -d

# Check services are healthy
docker compose ps

# View logs
docker compose logs -f postgres
```

### 4. Start Infrastructure (Option B: Manual)

If you prefer running PostgreSQL and Redis natively:

**PostgreSQL:**
```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16
createdb sosmesh

# Ubuntu/Debian
sudo apt install postgresql-16
sudo systemctl start postgresql
sudo -u postgres createdb sosmesh
```

**Redis (optional):**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

Update `.env` with your local connection strings.

### 5. Run Database Migrations

```bash
cd apps/api
pnpm prisma migrate dev
cd ../..
```

This will:
- Create database schema
- Generate Prisma Client
- Seed initial data (if seed script exists)

---

## Running the Stack

### Start All Services

```bash
# From repo root
pnpm dev
```

This starts:
- **API** on http://localhost:3001
- **Web** on http://localhost:3000

### Start Individual Services

```bash
# API only
cd apps/api
pnpm dev

# Web only
cd apps/web
pnpm dev
```

### Verify Services

**API Health Check:**
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}
```

**Web Dashboard:**
- Open http://localhost:3000 in browser
- You should see the SOSMesh operator dashboard

---

## Development Workflow

### Making Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make changes** in relevant workspace packages

3. **Lint & format:**
   ```bash
   pnpm lint:fix
   pnpm format
   ```

4. **Run tests:**
   ```bash
   # All tests
   pnpm test

   # UX accessibility tests
   pnpm ux:test-a11y

   # Secret scan
   pnpm test:secret-scan
   ```

5. **Commit with conventional commits:**
   ```bash
   git add .
   git commit -m "feat(api): add SOS message endpoint"
   ```

6. **Push and open PR:**
   ```bash
   git push origin feat/your-feature-name
   ```

### Adding Dependencies

**Workspace (root) dependency:**
```bash
pnpm add -D -w <package-name>
```

**Package-specific dependency:**
```bash
# In apps/api
cd apps/api
pnpm add <package-name>

# Or from root
pnpm --filter @sosmesh/api add <package-name>
```

### Database Migrations

**Create a new migration:**
```bash
cd apps/api
pnpm prisma migrate dev --name add_sos_priority_field
```

**Apply migrations (production):**
```bash
pnpm prisma migrate deploy
```

**Reset database (development):**
```bash
pnpm prisma migrate reset
```

### Code Generation

**Prisma Client:**
```bash
cd apps/api
pnpm prisma generate
```

**TypeScript from JSON Schema:**
```bash
cd packages/contracts
pnpm generate:types
```

---

## Mobile Development

### Android

1. **Open in Android Studio:**
   ```bash
   cd apps/android
   # Open this directory in Android Studio
   ```

2. **Sync Gradle** (automatically prompts)

3. **Run app:**
   - Select device/emulator
   - Click Run ▶️

4. **Lint & format:**
   ```bash
   ./gradlew ktlintFormat detekt
   ```

### iOS/watchOS (macOS only)

1. **Install CocoaPods dependencies:**
   ```bash
   cd apps/ios
   pod install
   ```

2. **Open workspace in Xcode:**
   ```bash
   open SOSMesh.xcworkspace
   ```

3. **Select scheme** (SOSMesh-iOS or SOSMesh-Watch)

4. **Run app:** Cmd+R

5. **Lint:**
   ```bash
   swiftlint lint --strict
   ```

---

## Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in .env
PORT=3002
```

### Docker Healthcheck Failing

**Error:** `sosmesh-postgres is unhealthy`

**Solution:**
```bash
# Check logs
docker compose logs postgres

# Restart service
docker compose restart postgres

# Full reset
docker compose down -v
docker compose up -d
```

### Prisma Client Out of Sync

**Error:** `PrismaClient is unable to run in production`

**Solution:**
```bash
cd apps/api
pnpm prisma generate
```

### pnpm Peer Dependency Errors

**Error:** `WARN Issues with peer dependencies`

**Solution:**
```bash
# Remove all node_modules and reinstall
pnpm clean
pnpm install
```

### ESLint/TypeScript Errors After Dependency Update

**Solution:**
```bash
# Rebuild all packages
pnpm build

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

## Next Steps

- Read [Architecture Decision Records (ADRs)](adr/)
- Review [UX prototypes](../prototypes/ux/)
- Check [Tech Debt Register](handover/tech-debt.md)
- Explore API docs: http://localhost:3001/api (Swagger UI)

---

## Getting Help

- Check [docs/](.) for detailed documentation
- Review [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
- Open an issue for bugs or feature requests

---

**Happy coding! 🚀**
