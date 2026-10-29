#!/usr/bin/env bash
set -euo pipefail

# SOSMesh Bootstrap Script
# First-time setup for monorepo development

echo "=== SOSMesh Bootstrap ==="
echo ""

# Check Node.js version
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install Node.js 20+ first."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required (found: $(node -v))"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Check pnpm
echo ""
echo "Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
  echo "⚠️  pnpm not found. Installing..."
  npm install -g pnpm@latest
fi
echo "✅ pnpm $(pnpm -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install --frozen-lockfile
echo "✅ Dependencies installed"

# Check .env
echo ""
echo "Checking environment..."
if [ ! -f .env ]; then
  echo "⚠️  .env not found. Copy .env.example to .env and fill in values."
  cp .env.example .env
  echo "✅ Created .env from template"
else
  echo "✅ .env exists"
fi

# Check Docker (optional)
echo ""
echo "Checking Docker (optional)..."
if command -v docker &> /dev/null && docker info &> /dev/null; then
  echo "✅ Docker $(docker -v | cut -d, -f1 | cut -d' ' -f3)"
  echo "   Run 'docker compose up -d' to start services"
else
  echo "⚠️  Docker not available (optional for local development)"
fi

echo ""
echo "=== Bootstrap Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your configuration"
echo "  2. Start services: docker compose up -d (or run postgres/redis manually)"
echo "  3. Run migrations: cd apps/api && pnpm prisma migrate dev"
echo "  4. Start dev servers: pnpm dev"
echo ""
