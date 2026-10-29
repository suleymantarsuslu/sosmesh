# Contributing to SOSMesh

Thank you for your interest in contributing to SOSMesh! This document provides guidelines and best practices for contributing to the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

Be respectful, professional, and constructive in all interactions. We are building emergency response software that could save lives — focus and quality matter.

---

## Getting Started

1. **Fork the repository** (for external contributors) or **clone directly** (for team members)
2. **Follow the setup guide:** [docs/getting-started.md](docs/getting-started.md)
3. **Check open issues** for tasks labeled `good-first-issue` or `help-wanted`
4. **Discuss major changes** in an issue before implementing

---

## Development Workflow

### 1. Create a Branch

Use descriptive branch names with prefixes:

```bash
# Features
git checkout -b feat/sos-priority-levels

# Bug fixes
git checkout -b fix/map-marker-clustering

# Documentation
git checkout -b docs/api-endpoint-guide

# Refactoring
git checkout -b refactor/prisma-queries

# Tests
git checkout -b test/sos-ingestion-e2e
```

### 2. Make Changes

- Write clean, readable code
- Follow [coding standards](#coding-standards)
- Add tests for new features
- Update documentation

### 3. Lint & Format

```bash
# Auto-fix linting issues
pnpm lint:fix

# Format all files
pnpm format

# Check formatting without changes
pnpm format:check
```

### 4. Run Tests

```bash
# All tests
pnpm test

# UX accessibility tests
pnpm ux:test-a11y

# Secret scan
pnpm test:secret-scan

# Dependency cycle check
pnpm test:cycles
```

### 5. Commit Changes

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git add .
git commit -m "feat(api): add SOS priority field to schema"
```

See [Commit Messages](#commit-messages) below.

### 6. Push and Create PR

```bash
git push origin feat/sos-priority-levels
```

Then open a Pull Request on GitHub/GitLab/Bitbucket.

---

## Coding Standards

### General Principles

- **DRY (Don't Repeat Yourself):** Extract common logic into reusable functions
- **SOLID:** Follow object-oriented design principles
- **KISS (Keep It Simple):** Prefer simple solutions over clever ones
- **YAGNI (You Aren't Gonna Need It):** Don't add features "just in case"

### TypeScript/JavaScript

**Style:** ESLint + Prettier (auto-formatted on save)

```typescript
// ✅ Good: Clear, typed, documented
/**
 * Validates SOS message priority level
 * @param priority - Priority level (1-5)
 * @returns true if valid, false otherwise
 */
export function isValidPriority(priority: number): boolean {
  return priority >= 1 && priority <= 5;
}

// ❌ Bad: No types, unclear, magic numbers
export function check(p) {
  return p >= 1 && p <= 5;
}
```

**Rules:**
- Use `const` and `let`, never `var`
- Prefer arrow functions for callbacks
- Use async/await over raw Promises
- Avoid `any` type (use `unknown` if necessary)
- Import order: external → internal → relative

### Kotlin (Android)

**Style:** ktlint + detekt

```kotlin
// ✅ Good: Coroutine-based, null-safe, clear naming
suspend fun fetchSosMessages(): List<SosMessage> {
    return withContext(Dispatchers.IO) {
        database.sosDao().getAllMessages()
    }
}

// ❌ Bad: Blocking, unsafe, unclear
fun getMessages(): List<SosMessage>? {
    return database.sosDao().getAllMessages()
}
```

**Rules:**
- Use `suspend` for async operations
- Prefer `sealed class` for state/result types
- Avoid `!!` (force unwrap) — use `?.` or `?:`
- Use Jetpack Compose for UI
- Room for local database

### Swift (iOS/watchOS)

**Style:** SwiftLint + swift-format

```swift
// ✅ Good: Async/await, error handling, clear naming
func fetchSosMessages() async throws -> [SosMessage] {
    let request = SosMessage.fetchRequest()
    return try await context.perform {
        try request.execute()
    }
}

// ❌ Bad: Callback hell, force unwrap, unclear
func getMessages(completion: @escaping ([SosMessage]?) -> Void) {
    let messages = try! context.fetch(request)
    completion(messages)
}
```

**Rules:**
- Use `async`/`await` for concurrency
- Avoid force unwrapping (`!`) — use `guard let` or `if let`
- Use SwiftUI for UI
- Core Data / SwiftData for persistence

### SQL / Prisma

**Migrations:**
- Descriptive names: `add_sos_priority_field` not `migration_123`
- Always test `up` and `down` migrations
- Never drop data in production without backup

**Queries:**
- Use Prisma's type-safe query builder
- Avoid raw SQL unless absolutely necessary
- Index frequently queried fields

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear, parseable commit history.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(api): add SOS priority endpoint` |
| `fix` | Bug fix | `fix(web): correct map marker z-index` |
| `docs` | Documentation | `docs(adr): add ADR-005 push notifications` |
| `style` | Formatting (no code change) | `style(api): fix indentation in dto` |
| `refactor` | Code refactor (no behavior change) | `refactor(api): extract sos validation logic` |
| `perf` | Performance improvement | `perf(web): optimize map render with clustering` |
| `test` | Add/fix tests | `test(api): add sos ingestion e2e test` |
| `chore` | Build/tooling/dependencies | `chore(deps): upgrade Prisma to v5.8` |
| `ci` | CI/CD changes | `ci: add CodeQL security scanning` |
| `revert` | Revert previous commit | `revert: revert "feat(api): add priority"` |

### Scopes

- `api` — Backend API (NestJS)
- `web` — Web dashboard (Next.js)
- `android` — Android app (Kotlin)
- `ios` — iOS/watchOS app (Swift)
- `contracts` — Shared schemas/types
- `design-tokens` — Design system
- `docs` — Documentation
- `ci` — CI/CD pipeline
- `deps` — Dependencies

### Examples

```bash
# Simple fix
git commit -m "fix(api): handle null priority in SOS query"

# Feature with body
git commit -m "feat(web): add real-time SOS map clustering

- Implement Mapbox clustering algorithm
- Add zoom-based cluster radius
- Update marker colors by priority level

Closes #123"

# Breaking change
git commit -m "feat(api)!: change SOS priority to 1-10 scale

BREAKING CHANGE: Priority field now accepts 1-10 instead of 1-5.
Update all clients to use new scale."
```

### Rules

- **Subject line:**
  - Max 72 characters
  - Imperative mood ("add" not "added" or "adds")
  - No period at end
  - Lowercase (except proper nouns)

- **Body (optional):**
  - Blank line after subject
  - Explain *what* and *why* (not *how*)
  - Wrap at 72 characters

- **Footer (optional):**
  - Reference issues: `Closes #123`, `Fixes #456`
  - Breaking changes: `BREAKING CHANGE: <description>`

---

## Pull Request Process

### Before Submitting

1. ✅ All tests pass locally
2. ✅ Code is linted and formatted
3. ✅ Documentation is updated
4. ✅ Commit messages follow convention
5. ✅ Branch is up-to-date with `main`

### PR Title

Use same format as commit messages:

```
feat(api): add SOS priority field
```

### PR Description Template

```markdown
## Description
Brief summary of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Added X
- Fixed Y
- Updated Z

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if UI changes)
(Add screenshots here)

## Related Issues
Closes #123
```

### Review Process

- At least 1 approval required
- CI checks must pass
- No unresolved comments
- Merge commits preferred (keep history)

### After Merge

- Delete feature branch
- Update related issues/tasks
- Deploy to staging/production (if applicable)

---

## Testing

### Unit Tests

**Backend (Jest):**
```bash
cd apps/api
pnpm test
```

**Web (Jest + React Testing Library):**
```bash
cd apps/web
pnpm test
```

### Integration Tests

**E2E (Playwright):**
```bash
pnpm ux:test-a11y
```

### Mobile Tests

**Android (Espresso):**
- Run in Android Studio: Right-click test → Run

**iOS (XCTest):**
- Cmd+U in Xcode

### Coverage

Aim for:
- **Backend:** 80%+ coverage
- **Web:** 70%+ coverage
- **Mobile:** 60%+ coverage (BLE logic critical)

---

## Documentation

### When to Update Docs

- New feature → Update `README.md` and relevant guide
- API change → Update OpenAPI/Swagger docs
- Architecture decision → Add ADR in `docs/adr/`
- Configuration change → Update `docs/getting-started.md`

### ADRs (Architecture Decision Records)

For significant architectural decisions, create an ADR:

```bash
# Create new ADR
cp docs/adr/ADR-000-template.md docs/adr/ADR-006-your-decision.md
```

Format: [ADR template](docs/adr/ADR-000-template.md)

### Code Comments

- **DO:** Explain *why* (business logic, edge cases, workarounds)
- **DON'T:** Explain *what* (code should be self-documenting)

```typescript
// ✅ Good: Explains non-obvious reasoning
// We retry 3 times because BLE can drop packets during mesh relay
const MAX_RETRIES = 3;

// ❌ Bad: States the obvious
// Set max retries to 3
const MAX_RETRIES = 3;
```

---

## Questions?

- Open an issue for clarification
- Ask in team chat/Slack
- Review existing PRs for examples

---

**Thank you for contributing to SOSMesh! 🚀**
