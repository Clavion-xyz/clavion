# Testing Guide

Clavion uses [vitest](https://vitest.dev/) as its test runner. Tests are organized into four categories by scope and requirements.

## Test Categories

| Category | Count | Requirements | What It Covers |
|----------|-------|-------------|----------------|
| **Unit** | ~300+ | None | Schemas, policy engine, builders, risk scorer, keystore, wallet service, approval tokens, manifest validation, scanner, ISCLClient, intent builder |
| **Integration** | ~30+ | None | HTTP API routes, adapter client against real Fastify, skill wrappers end-to-end, rate limiting |
| **Security** | ~28 | Docker (some tests) | Domain A isolation, Domain B integrity, Domain C sandbox enforcement, tampered package detection |
| **E2E** | ~6 | Anvil + `BASE_RPC_URL` | Full pipeline on Anvil Base fork: build -> preflight -> approve -> sign -> broadcast |

## Running Tests

```bash
# All tests
npm test

# By category
npm run test:unit
npm run test:integration
npm run test:security
npm run test:e2e

# Watch mode (re-runs on file changes)
npm run test:watch

# E2E requires Anvil and a Base RPC endpoint
BASE_RPC_URL=https://mainnet.base.org npm run test:e2e
```

## Test Directory Structure

```
tests/
  unit/                            -- Fast, isolated, no external dependencies
    schema-validation.test.ts
    policy-engine.test.ts
    wallet-service.test.ts
    keystore.test.ts
    canonicalization.test.ts
    transfer-builder.test.ts
    approve-builder.test.ts
    swap-builder.test.ts
    risk-scorer.test.ts
    preflight-service.test.ts
    manifest-validator.test.ts
    manifest-signer.test.ts
    static-scanner.test.ts
    iscl-client.test.ts
    intent-builder.test.ts
    audit-rate-limit.test.ts
    broadcast.test.ts
    skill-registry-service.test.ts
    ...

  integration/                     -- Real HTTP, ephemeral Fastify servers
    health.test.ts
    tx-build-validation.test.ts
    adapter-client.test.ts
    adapter-skills.test.ts
    rate-limit.test.ts
    skill-routes.test.ts
    ...

  security/                        -- Trust domain enforcement
    domain-a-isolation.test.ts     -- Skills cannot access keys or RPC
    domain-b-integrity.test.ts     -- Policy/approval enforcement, replay protection
    domain-c-tampered-package.test.ts  -- Tampered manifest detection
    sandbox-isolation.test.ts      -- Docker sandbox constraints (requires Docker)

  e2e/
    full-flow.test.ts              -- Anvil fork: build -> preflight -> approve -> sign -> broadcast

  helpers/
    anvil-fork.ts                  -- Anvil process management + USDC funding
    docker-check.ts                -- Docker availability detection
```

## Fixtures

Test fixtures live in `spec/fixtures/`:

- `valid-intents.ts` -- One valid TxIntent per action type (transfer, transfer_native, approve, swap_exact_in, swap_exact_out)
- `invalid-intents.ts` -- Malformed and edge-case intents for rejection testing
- `skill-manifests.ts` -- Valid and invalid SkillManifest examples
- `hash-fixtures.ts` -- Pre-computed canonicalization hashes for determinism verification

## Skipping Tests

Tests that require external infrastructure skip gracefully when dependencies are unavailable:

- **Docker tests** use `describe.skipIf(!dockerAvailable)` -- skipped when Docker is not running
- **E2E tests** use `describe.skipIf(!anvilAvailable || !baseRpcUrl)` -- skipped without Anvil or RPC
- **Security tests** that exercise the Docker sandbox skip without Docker; Domain B tests always run

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/test.yml`) runs on push to `main`/`develop` and on PRs:

```
checkout -> setup-node -> npm ci -> build -> lint -> format:check -> test:unit -> test:integration
```

Security and E2E tests require Docker/Anvil and are not run in CI by default.

## Writing New Tests

- Unit tests: import the module directly, mock external dependencies (RPC, filesystem)
- Integration tests: use `buildApp()` to create an ephemeral Fastify server on port 0, test via real HTTP
- Security tests: test against the threat model scenarios (A1-A4, B1-B4, C1-C4)
- All mock RPC factories must include all interface methods (check `tests/helpers/` for patterns)

See the [Contributing Guide](contributing.md) for PR test requirements and coding standards.
