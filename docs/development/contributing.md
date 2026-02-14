# Contributing Guide

## Overview

Thank you for your interest in contributing to Clavion/ISCL. This project is a security-critical runtime that isolates private keys from untrusted AI agent code. Contributions are welcome, but three ground rules apply to every change:

1. **Security first.** The six security invariants listed below are non-negotiable. No PR that weakens them will be merged.
2. **Test everything.** Every change must pass the existing test suite, and new features must include tests.
3. **Respect trust domain boundaries.** Every line of code belongs to exactly one of the three trust domains. Never blur these boundaries.

If you are unsure whether a proposed change fits the architecture, open an issue to discuss before writing code.

## Getting Started

1. **Fork and clone** the repository:

   ```bash
   git clone https://github.com/<your-fork>/clavion.git
   cd clavion
   ```

2. **Install dependencies** (requires Node.js >= 20 and npm >= 9):

   ```bash
   npm install
   ```

3. **Build all packages** (TypeScript project references, compiled in dependency order):

   ```bash
   npm run build
   ```

4. **Run all tests** to confirm a clean baseline:

   ```bash
   npm test
   ```

5. **Verify the server starts** and responds:

   ```bash
   npm start
   curl http://localhost:3100/v1/health
   # Expected: {"status":"ok","version":"0.1.0","uptime":...}
   ```

If any step fails, see the [Dev Setup Guide](dev-setup.md) for prerequisites (Anvil, Docker, environment variables).

## Code Organization

The repository is an npm-workspaces monorepo with 14 packages, organized by trust domain. The trust domain model is the single most important architectural concept in this project.

### Domain A -- Untrusted

Adapters and plugins that run agent code. No keys, no direct RPC access, no signing.

| Package | Description |
|---------|-------------|
| `@clavion/adapter-openclaw` | OpenClaw thin skill wrappers |
| `@clavion/adapter-mcp` | MCP server for Claude Desktop, Cursor, IDEs |
| `@clavion/plugin-eliza` | ElizaOS (ai16z) plugin with 5 actions |
| `@clavion/adapter-telegram` | Telegram bot (agent + approval UI) |

### Domain B -- Trusted

The secure core. Keys, policy enforcement, signing, audit logging, RPC access.

| Package | Description |
|---------|-------------|
| `@clavion/core` | API server, transaction builders, approval flow |
| `@clavion/signer` | Encrypted keystore and signing |
| `@clavion/audit` | Append-only audit trace (SQLite) |
| `@clavion/policy` | Policy engine and config validation |
| `@clavion/preflight` | Risk scoring and simulation |
| `@clavion/registry` | Skill manifest validation and registry |
| `@clavion/types` | Shared interfaces, schemas, RPC types |

### Domain C -- Limited Trust

Sandboxed execution. No key access, API-only communication with Core.

| Package | Description |
|---------|-------------|
| `@clavion/sandbox` | Container isolation runner |

### Tooling

| Package | Description |
|---------|-------------|
| `@clavion/cli` | Key management CLI (import, generate, list) |
| `@clavion/sdk` | SDK interface (stub, planned for v0.2) |

Additional directories: `tests/` (cross-package integration, security, and E2E tests), `tools/` (fixture generation, hash utilities), `examples/`, `docs/`, `docker/`.

## Coding Standards

### TypeScript

- **Strict mode** is enforced (`strict: true` in the root tsconfig, plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
- **ESM with Node16 module resolution.** All packages use `"type": "module"` and the `Node16` module/moduleResolution settings.
- **`additionalProperties: false`** on every JSON schema. No undocumented fields are allowed to pass validation.
- **Named imports for AJV:** use `import { Ajv } from "ajv"`. Default imports do not work under Node16.
- **`createRequire` pattern** for CJS packages that lack ESM exports (`ajv-formats`, `canonicalize`):

  ```typescript
  import { createRequire } from "node:module"
  const require = createRequire(import.meta.url)
  const addFormats = require("ajv-formats")
  ```

- **viem** is the preferred EVM library over ethers.

### Naming Conventions

| Element | Convention | Examples |
|---------|-----------|----------|
| Files | kebab-case | `risk-scorer.ts`, `audit-trace-service.ts` |
| Classes | PascalCase | `PolicyEngine`, `WalletService` |
| Interfaces / Types | PascalCase | `TxIntent`, `PolicyConfig`, `RpcClient` |
| Functions | camelCase | `buildFromIntent`, `computeRiskScore` |
| Constants | UPPER_SNAKE_CASE | `MAX_SCORE`, `HIGH_SLIPPAGE_BPS` |

### Code Style

- **Prettier** for formatting. Run `npm run format:check` before submitting.
- **ESLint** for linting. Run `npm run lint` before submitting.
- Follow the formatting conventions already present in the codebase. When in doubt, let Prettier decide.

## Testing Requirements

All pull requests must satisfy:

1. **`npm test` passes** -- this runs unit and integration tests.
2. **New features include unit tests.** If you add a builder, service, route, or adapter method, add corresponding tests.
3. **Fund-affecting features include security tests.** Changes to signing, policy enforcement, approval flow, or key management must include tests that verify Domain B integrity.
4. **Mock RPC factories implement all `RpcClient` methods**, including `readNativeBalance`. Incomplete mocks cause runtime failures in unrelated tests.
5. **Test fixtures live in `tools/fixtures/`.** When adding a new valid fixture, also add its pre-computed hash to `hash-fixtures.ts` (the canonicalization test iterates all entries).

### Test categories at a glance

| Category | Command | Requirements |
|----------|---------|-------------|
| Unit | `npm run test:unit` | None |
| Integration | `npm run test:integration` | None |
| Security | `npm run test:security` | Docker (for sandbox tests) |
| E2E | `npm run test:e2e` | Anvil + `BASE_RPC_URL` |

Tests that require Docker or Anvil skip gracefully when those dependencies are unavailable.

For the full testing guide, see [Testing Guide](testing.md).

## Security Rules (Non-Negotiable)

These six invariants are the foundation of the project's security model. Every contributor must understand and uphold them.

1. **Private keys exist only in Domain B** -- never in Domain A (skills/adapters) or Domain C (sandbox).
2. **Every signature passes PolicyEngine + Preflight** -- there are no bypass paths.
3. **Skills have no direct RPC access** -- only ISCL Core contacts the blockchain.
4. **All fund-affecting operations use TxIntent v1** -- no arbitrary calldata signing.
5. **All critical steps are audit logged** -- correlated by `intentId`.
6. **Approval tokens are single-use with TTL** -- no replay.

### Additional design rules

- New crypto logic goes in Domain B only, inside the appropriate package.
- New skill-facing functionality must be exposed via the ISCL API, never through direct module access.
- New external network calls must go through the RPC allowlist in Domain B.
- Sandbox code belongs to Domain C: no key access, no unrestricted network.
- Cross-domain communication always goes through the ISCL Core API (localhost HTTP).

If your change touches signing, key management, policy enforcement, or approval flow, flag it in the PR description. These changes receive extra review scrutiny.

## Pull Request Process

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feat/my-feature main
   ```

2. **Write code and tests.** Follow the coding standards and testing requirements above.

3. **Run linting and formatting checks:**

   ```bash
   npm run lint
   npm run format:check
   ```

4. **Run the full test suite:**

   ```bash
   npm run build
   npm test
   ```

   All tests must pass. If you have Docker available, also run `npm run test:security`.

5. **Submit a pull request** with a clear description of what changed and why. Include:
   - A summary of the change (what problem it solves or what feature it adds).
   - Which trust domain(s) the change touches.
   - How it was tested.

6. **PR review.** Security-sensitive changes (Domain B, key management, policy, approval) require extra scrutiny and may take longer to review.

7. **Merge to `main`** after approval.

## Commit Style

The project follows [Conventional Commits](https://www.conventionalcommits.org/). Use the appropriate prefix for each commit:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat:` | New feature | `feat: add swap_exact_out support for 1inch` |
| `fix:` | Bug fix | `fix: prevent approval token replay across intents` |
| `chore:` | Maintenance tasks | `chore: remove old doc/ directory` |
| `build:` | Build system changes | `build: move Docker files to docker/` |
| `docs:` | Documentation only | `docs: add community files and restructure documentation` |
| `refactor:` | Code restructuring (no behavior change) | `refactor: extract @clavion/types package` |
| `test:` | Test additions or changes | `test: add Domain B integrity tests for replay protection` |

Keep commit messages concise. The first line should be under 72 characters. Use the body for additional context when needed.

## Common Gotchas

These are recurring pitfalls that have caught contributors before. Save yourself debugging time by reading them.

- **JSON Schema validates structure only.** Business logic like deadline expiration must be enforced in code, not in the schema.
- **TxIntentSchema `$defs`/`$ref` with AJV.** When embedding the schema in a wrapper object, hoist `$defs` to the wrapper root. AJV cannot resolve `$ref` that points into a nested `$defs`.
- **Fastify custom AJV does not coerce types.** The server uses `strict: true`, so query parameters arrive as strings. Use `type: "string"` with a `pattern` in route schemas, not `type: "integer"`.
- **Tests with `requireApprovalAbove.valueWei: "0"` must pass `promptFn` to `buildApp()`.** Without it, the approval service falls through to readline and the test hangs indefinitely.
- **Hash fixtures must stay in sync.** When you add a new valid fixture to `tools/fixtures/valid-intents.ts`, you must also add its canonical hash to `tools/fixtures/hash-fixtures.ts`. The canonicalization test iterates all entries.
- **`buildFromIntent()` is async.** The 1inch swap builder returns a Promise. All call sites must `await` it.
- **CJS interop.** Packages like `ajv-formats` and `canonicalize` do not have proper ESM exports. Always use the `createRequire` pattern shown in the TypeScript section above.

## Questions and Feedback

- **Bugs and feature requests:** open an issue on GitHub with a clear description and reproduction steps.
- **Environment setup problems:** see the [Dev Setup Guide](dev-setup.md) for prerequisites and environment variables.
- **Architecture questions:** see the [Engineering Spec](../architecture/engineering-spec.md) and [Threat Model](../architecture/threat-model.md).
- **API and schema details:** see the [API Overview](../api/overview.md) and [Schema Reference](../api/schemas.md).
