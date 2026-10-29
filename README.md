# SOSMesh

**Emergency Mesh Network Platform**

[![License](https://img.shields.io/badge/license-SEE%20LICENSE-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-orange.svg)](https://pnpm.io)

> ⚠️ **IMPORTANT:** This system does NOT replace official emergency services (112 in Turkey, 911 in USA). This is an experimental emergency communication mesh network prototype.

---

## Overview

SOSMesh is a **cross-platform emergency mesh network** that enables communication when internet and cellular networks fail. The system uses **Bluetooth Low Energy (BLE) mesh** for offline device-to-device message relay and provides a real-time operator dashboard for emergency response coordination.

**Key Features:**
- 📱 Native mobile apps (Android/iOS) with offline BLE mesh
- ⌚ Smartwatch support (Wear OS/watchOS)
- 🌐 Real-time web operator dashboard
- 🤖 AI-powered emergency classification (Meta Llama)
- 🔒 End-to-end encrypted messages
- 📍 Location tracking and mapping
- 🚨 5-stage SOS status timeline

---

## Project Structure

```
sosmesh-monorepo/
├── apps/
│   ├── api/          # NestJS backend API
│   ├── web/          # Next.js operator dashboard
│   ├── android/      # Kotlin native Android app
│   └── ios/          # Swift native iOS/watchOS app
├── packages/
│   ├── contracts/    # Shared JSON schemas & TypeScript types
│   └── design-tokens/# Design system tokens (colors, spacing, typography)
├── docs/             # Documentation & ADRs
├── prototypes/       # UX prototypes (HTML/CSS)
├── scripts/          # Build & validation scripts
└── tests/            # Cross-package integration tests
```

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 8+
- **Docker** (optional, for local PostgreSQL/Redis)
- **Android Studio** (for Android development)
- **Xcode** (for iOS/watchOS development, macOS only)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd sosmesh-monorepo

# Bootstrap (install dependencies & setup .env)
pnpm bootstrap

# Copy environment template and configure
cp .env.example .env
# Edit .env with your API keys and secrets

# Start services (Docker)
docker compose up -d

# Run database migrations
cd apps/api
pnpm prisma migrate dev
cd ../..

# Start all dev servers
pnpm dev
```

**Access Points:**
- API: http://localhost:3001
- Web Dashboard: http://localhost:3000

For detailed setup instructions, see [Getting Started Guide](docs/getting-started.md).

---

## Development

### Available Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all dev servers (parallel)
pnpm dev

# Lint all code
pnpm lint

# Format code
pnpm format

# Run tests
pnpm test

# Run UX accessibility tests
pnpm ux:test-a11y

# Clean all build artifacts
pnpm clean
```

### Linting & Formatting

- **JavaScript/TypeScript:** ESLint + Prettier
- **Kotlin:** ktlint + detekt
- **Swift:** SwiftLint + swift-format

Configuration files: `.eslintrc.js`, `.prettierrc.json`, `.editorconfig`, `.editorconfig-kt`, `detekt.yml`, `.swiftlint.yml`, `.swift-format`

---

## Documentation

- **Getting Started:** [docs/getting-started.md](docs/getting-started.md)
- **Architecture Decisions (ADRs):** [docs/adr/](docs/adr/)
- **Master Plan:** [docs/SOSMesh_Tam_Gelistirme_Master_Plani.docx](docs/SOSMesh_Tam_Gelistirme_Master_Plani.docx)
- **Status Tracking:** [docs/handover/status.json](docs/handover/status.json)
- **UX Design System:** [docs/ux/](docs/ux/)
- **Tech Debt Register:** [docs/handover/tech-debt.md](docs/handover/tech-debt.md)

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Commit Convention:** We use [Conventional Commits](https://www.conventionalcommits.org/)

```
feat(api): add SOS message ingestion endpoint
fix(web): correct map marker clustering
docs(adr): add ADR-005 for push notification strategy
chore(deps): upgrade Prisma to v5.8
```

---

## Testing

### Backend Tests
```bash
cd apps/api
pnpm test
```

### Web Tests
```bash
cd apps/web
pnpm test
```

### Mobile Tests
- **Android:** Run instrumented tests in Android Studio
- **iOS:** Run unit/UI tests in Xcode

### UX Accessibility Tests (Playwright)
```bash
pnpm ux:test-a11y
```

---

## Deployment

_(To be documented in production deployment guide)_

---

## License

See [LICENSE](LICENSE) file for details.

---

## Support

For questions, issues, or feature requests, please open an issue on the repository.

---

**⚠️ Emergency Disclaimer:** SOSMesh is a prototype. Always use official emergency services (112/911) in real emergencies.
