# Repository Structure

The repository is organized by trust domain. Each top-level directory maps to one of the three architectural domains, with supporting directories for schemas, tests, and tooling.

## Top-Level Layout

```
core/               -- Domain B (Trusted) -- ISCL Core services
sandbox/            -- Domain C (Limited Trust) -- Container isolation
adapter/            -- Domain A (Untrusted) -- OpenClaw adapter + skill wrappers
spec/               -- Schemas and test fixtures
tests/              -- All test suites (unit, integration, security, e2e)
scripts/            -- Demo and utility scripts
docs/               -- Documentation (this directory)
doc/                -- Legacy documentation (being migrated)
openclaw-skills/    -- OpenClaw skill packages (SKILL.md + runner scripts)
iscl-claude-code-skills/  -- Claude Code skill packages (development guidance)
```

## Core (Domain B)

```
core/
  main.ts                    -- Entry point
  demo-boot.ts               -- Demo mode: auto-unlock wallet + auto-approve
  types.ts                   -- Shared type definitions
  api/
    app.ts                   -- Fastify app builder
    routes/
      health.ts              -- GET /v1/health
      tx.ts                  -- POST /v1/tx/* (build, preflight, approve-request, sign-and-send)
      balance.ts             -- GET /v1/balance/:token/:account
      skills.ts              -- Skill registry CRUD routes
  wallet/
    keystore.ts              -- EncryptedKeystore (scrypt + AES-256-GCM)
    wallet-service.ts        -- Signing pipeline
  policy/
    policy-engine.ts         -- Intent evaluation: allow / deny / require_approval
    policy-config.ts         -- Config schema and loader
  approval/
    approval-service.ts      -- User confirmation prompt
    approval-token-manager.ts -- Single-use TTL tokens
  audit/
    audit-trace-service.ts   -- Append-only SQLite event log
  tx/builders/
    index.ts                 -- Action type -> builder dispatcher
    transfer-builder.ts      -- ERC-20 transfer calldata
    transfer-native-builder.ts -- Native ETH transfer
    approve-builder.ts       -- ERC-20 approve calldata
    swap-builder.ts          -- UniswapV3 SwapRouter02 calldata
  preflight/
    preflight-service.ts     -- eth_call simulation + risk scoring
    risk-scorer.ts           -- 7 additive rules, capped at 100
  rpc/
    rpc-client.ts            -- RPC client interface
    viem-rpc-client.ts       -- Viem implementation
  skill/
    manifest-validator.ts    -- SkillManifest schema check
    manifest-signer.ts       -- ECDSA sign/verify (viem)
    file-hasher.ts           -- SHA-256 file integrity
    static-scanner.ts        -- 5 rule categories for code analysis
    skill-registry-service.ts -- Orchestrates registration pipeline
  canonicalize/
    intent-hash.ts           -- JCS + keccak256
  schemas/
    validator.ts             -- AJV strict-mode validator
```

## Adapter (Domain A)

```
adapter/
  shared/
    iscl-client.ts           -- HTTP client for ISCL Core
  skills/
    intent-builder.ts        -- TxIntent constructor with safe defaults
    types.ts                 -- Adapter-side type definitions
    clavion-transfer/        -- ERC-20 transfer skill wrapper
    clavion-transfer-native/ -- Native ETH transfer skill wrapper
    clavion-approve/         -- ERC-20 approve skill wrapper
    clavion-swap/            -- Uniswap V3 swap skill wrapper
    clavion-balance/         -- Balance lookup skill wrapper
  openclaw-agent.ts          -- OpenClaw-compatible tool registry + executor
  install.ts                 -- Installation verification
```

## Sandbox (Domain C)

```
sandbox/
  sandbox-runner.ts          -- Docker-based skill executor
  seccomp-no-spawn.json      -- Syscall filter profile
```

## Spec (Schemas + Fixtures)

```
spec/
  schemas/
    txintent-schema.ts       -- TxIntent v1 JSON Schema
    skill-manifest-schema.ts -- SkillManifest v1 JSON Schema
  fixtures/
    valid-intents.ts         -- Valid TxIntent per action type
    invalid-intents.ts       -- Edge cases and malformed intents
    skill-manifests.ts       -- Skill manifest examples
    generate-hashes.ts       -- Regenerate file hashes
    index.ts                 -- Re-exports all fixtures
```

## Tests

```
tests/
  unit/                      -- Schema, policy, wallet, builders, risk, etc.
  integration/               -- HTTP API, adapter client, skill wrappers
  security/                  -- Trust domain isolation, sandbox escape, tampered packages
  e2e/                       -- Anvil fork: full build -> sign -> broadcast flow
  helpers/                   -- Anvil fork management, Docker availability check
```
