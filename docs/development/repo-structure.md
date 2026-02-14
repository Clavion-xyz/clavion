# Repository Structure

Clavion is organized as an npm workspaces monorepo. Each package maps to one of the three architectural trust domains.

## Top-Level Layout

```
packages/              -- All packages (see below)
tests/                 -- Cross-package integration, security, and e2e tests
tools/                 -- Fixture generation, hash utilities
examples/              -- Example scripts and policy configs
docs/                  -- Documentation (this directory)
docker/                -- Dockerfile and Docker Compose configuration
scripts/               -- Demo scripts (demo-transfer.ts, demo-swap.ts)
openclaw-skills/       -- OpenClaw skill packages (SKILL.md + runner scripts)
```

## Domain B -- Trusted (ISCL Core)

Private keys, policy, signing, audit, RPC access.

```
packages/types/                          @clavion/types
  src/
    index.ts                             -- Shared TypeScript interfaces (TxIntent, BuildPlan, etc.)
    schemas/
      txintent-schema.ts                 -- TxIntent v1 JSON Schema (AJV strict mode)
      skill-manifest-schema.ts           -- SkillManifest v1 JSON Schema

packages/audit/                          @clavion/audit
  src/
    audit-trace-service.ts               -- Append-only SQLite event log, rate limit tracking

packages/policy/                         @clavion/policy
  src/
    policy-engine.ts                     -- Intent evaluation: allow / deny / require_approval
    policy-config.ts                     -- Config schema and loader

packages/signer/                         @clavion/signer
  src/
    keystore.ts                          -- EncryptedKeystore (scrypt + AES-256-GCM)
    wallet-service.ts                    -- Signing pipeline
    mnemonic.ts                          -- BIP-39 mnemonic import with HD derivation

packages/preflight/                      @clavion/preflight
  src/
    preflight-service.ts                 -- eth_call simulation + risk scoring
    risk-scorer.ts                       -- 7 additive rules, capped at 100

packages/registry/                       @clavion/registry
  src/
    skill-registry-service.ts            -- Orchestrates skill registration pipeline
    manifest-signer.ts                   -- ECDSA sign/verify (viem)
    file-hasher.ts                       -- SHA-256 file integrity
    static-scanner.ts                    -- 5 rule categories for code analysis

packages/core/                           @clavion/core
  src/
    main.ts                              -- Production entry point
    demo-boot.ts                         -- Demo mode: auto-unlock + auto-approve
    api/
      app.ts                             -- Fastify app builder and service wiring
      routes/
        health.ts                        -- GET /v1/health
        tx.ts                            -- POST /v1/tx/* (build, preflight, approve-request, sign-and-send)
        balance.ts                       -- GET /v1/balance/:token/:account
        skills.ts                        -- Skill registry CRUD routes
        approval-ui.ts                   -- Web approval routes + inline HTML dashboard
    tx/builders/
      index.ts                           -- Action type -> builder dispatcher (async)
      transfer-builder.ts                -- ERC-20 transfer calldata
      transfer-native-builder.ts         -- Native ETH transfer
      approve-builder.ts                 -- ERC-20 approve calldata
      swap-builder.ts                    -- UniswapV3 SwapRouter02 calldata
      swap-oneinch-builder.ts            -- 1inch Swap API v6 calldata
      build-utils.ts                     -- Shared: txRequest hashing
    aggregator/
      oneinch-client.ts                  -- 1inch HTTP client (fetch + AbortController)
      oneinch-types.ts                   -- 1inch API request/response types
      oneinch-routers.ts                 -- Known 1inch router addresses per chain
    approval/
      approval-service.ts                -- User confirmation prompt (CLI or web)
      approval-token-manager.ts          -- Single-use TTL tokens
      pending-approval-store.ts          -- In-memory store bridging web UI to blocking promptFn
    rpc/
      rpc-router.ts                      -- Multi-chain RPC routing
      resolve-rpc.ts                     -- Chain-scoped RPC resolution
      parse-rpc-env.ts                   -- ISCL_RPC_URL_{chainId} env parser
      viem-rpc-client.ts                 -- Viem-based RPC implementation
    canonicalize/
      intent-hash.ts                     -- JCS + keccak256
    schemas/
      validator.ts                       -- AJV strict-mode validator
```

## Domain A -- Untrusted (Adapters)

No keys, no direct RPC, no signing. Communicates with Domain B via localhost HTTP.

```
packages/adapter-openclaw/               @clavion/adapter-openclaw
  src/
    shared/iscl-client.ts                -- HTTP client for ISCL Core
    skills/
      intent-builder.ts                  -- TxIntent constructor with safe defaults
      types.ts                           -- Adapter-side type definitions
      clavion-transfer/                  -- ERC-20 transfer skill wrapper
      clavion-transfer-native/           -- Native ETH transfer skill wrapper
      clavion-approve/                   -- ERC-20 approve skill wrapper
      clavion-swap/                      -- Swap skill wrapper
      clavion-balance/                   -- Balance lookup skill wrapper
    openclaw-agent.ts                    -- OpenClaw-compatible tool registry + executor

packages/adapter-mcp/                    @clavion/adapter-mcp
  src/
    server.ts                            -- MCP server setup (6 tools)
    shared/iscl-client.ts                -- HTTP client for ISCL Core
    tools/
      schemas.ts                         -- Zod schemas for MCP tool parameters
      transfer.ts                        -- clavion_transfer tool handler
      transfer-native.ts                 -- clavion_transfer_native tool handler
      approve.ts                         -- clavion_approve tool handler
      swap.ts                            -- clavion_swap tool handler
      balance.ts                         -- clavion_balance tool handler
      tx-status.ts                       -- clavion_tx_status tool handler

packages/plugin-eliza/                   @clavion/plugin-eliza
  src/
    index.ts                             -- ElizaOS plugin definition (5 actions + service + provider)
    service.ts                           -- ClavionService (ISCLClient lifecycle)
    provider.ts                          -- Wallet context provider for LLM
    templates.ts                         -- LLM extraction templates for each action
    actions/
      transfer.ts                        -- CLAVION_TRANSFER action
      transfer-native.ts                 -- CLAVION_TRANSFER_NATIVE action
      approve.ts                         -- CLAVION_APPROVE action
      swap.ts                            -- CLAVION_SWAP action
      balance.ts                         -- CLAVION_BALANCE action
    shared/
      iscl-client.ts                     -- HTTP client for ISCL Core
      intent-builder.ts                  -- TxIntent construction helpers
      pipeline.ts                        -- Shared secure pipeline (build -> approve -> sign)

packages/adapter-telegram/               @clavion/adapter-telegram
  src/
    bot.ts                               -- grammY bot setup with 7 commands
    config.ts                            -- TelegramAdapterConfig (env vars)
    main.ts                              -- Entry point
    shared/iscl-client.ts                -- HTTP client for ISCL Core
    commands/
      start.ts                           -- /start and /help
      transfer.ts                        -- /transfer command
      send.ts                            -- /send (alias for transfer)
      swap.ts                            -- /swap command
      approve-token.ts                   -- /approve command
      balance.ts                         -- /balance command
      status.ts                          -- /status (health check)
    approval/
      approval-flow.ts                   -- ActiveTransactionStore, approval polling
      formatters.ts                      -- HTML message formatters
    middleware/
      auth.ts                            -- Chat allowlist + sender verification
```

## Domain C -- Limited Trust (Sandbox)

No keys, no network. API-only communication with Domain B.

```
packages/sandbox/                        @clavion/sandbox
  src/
    sandbox-runner.ts                    -- Docker-based skill executor
  docker/
    seccomp-no-spawn.json                -- Syscall filter profile
```

## CLI and SDK

```
packages/cli/                            @clavion/cli
  src/
    main.ts                              -- Entry point (clavion-cli)
    commands/key.ts                      -- Key management: import, import-mnemonic, generate, list
    io.ts                                -- Masked passphrase input, injectable I/O

packages/sdk/                            @clavion/sdk
  src/
    index.ts                             -- SDK interface (stub, v0.2)
```

## Fixtures and Tools

```
tools/fixtures/
  valid-intents.ts                       -- Valid TxIntent per action type (6 fixtures)
  invalid-intents.ts                     -- Edge cases and malformed intents
  skill-manifests.ts                     -- Skill manifest examples
  hash-fixtures.ts                       -- Expected keccak256 hashes
  generate-hashes.ts                     -- Regenerate hash fixtures
  index.ts                               -- Re-exports all fixtures
```

## Tests

```
tests/
  integration/                           -- HTTP API, adapter client, skill wrappers, rate limiting
  security/                              -- Trust domain isolation, sandbox escape, tampered packages
  e2e/                                   -- Anvil fork: full build -> sign -> broadcast flow
  helpers/                               -- Anvil fork management, Docker availability check
packages/*/test/                         -- Per-package unit tests
```

## Docker

```
docker/
  Dockerfile.core                        -- Multi-stage build: Node 20 Alpine, non-root iscl user
  compose.yaml                           -- 3-service stack: Anvil, ISCL Core, OpenClaw (demo profile)
```
