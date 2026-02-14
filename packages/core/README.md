# @clavion/core

Fastify API server for the Clavion ISCL (Independent Secure Crypto Layer). Handles
transaction building, policy enforcement, preflight simulation, approval flow, signing,
and broadcast. This is the trusted Domain B component -- all private keys and RPC
access live here.

## Install

This is a workspace package. From the monorepo root:

```bash
npm install
npm run build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ISCL_PORT` | `3100` | HTTP listen port |
| `ISCL_HOST` | `127.0.0.1` | Bind address |
| `BASE_RPC_URL` | -- | RPC URL for Base (chain 8453, legacy) |
| `ISCL_RPC_URL_{chainId}` | -- | RPC URL per chain (e.g. `ISCL_RPC_URL_1`) |
| `ISCL_AUDIT_DB` | `./iscl-audit.sqlite` | SQLite path for audit trace |
| `ISCL_KEYSTORE_PATH` | `~/.iscl/keystore` | Encrypted keystore directory |
| `ISCL_APPROVAL_MODE` | `cli` | Approval mode: `cli`, `web`, or `auto` |
| `ONEINCH_API_KEY` | -- | 1inch API key for aggregated swaps |

## Supported Chains

Ethereum (1), Optimism (10), Arbitrum (42161), Base (8453).

Set one `ISCL_RPC_URL_{chainId}` per chain. When multiple are configured, Core
routes RPC calls automatically.

## Running

```bash
# Development (tsx)
npm run dev

# Production
npm run build && npm start

# Docker
docker build -f docker/Dockerfile.core -t clavion-core .
docker run -p 3100:3100 -e BASE_RPC_URL=https://... clavion-core
```

## API Endpoints

```
GET  /v1/health                -- Version and status
POST /v1/tx/build              -- Build transaction from TxIntent
POST /v1/tx/preflight          -- Simulate and score risk
POST /v1/tx/approve-request    -- Request user approval, issue token
POST /v1/tx/sign-and-send      -- Sign and broadcast (requires approval token)
GET  /v1/tx/:hash              -- Transaction receipt lookup
GET  /v1/balance/:token/:account -- ERC-20 balance
POST /v1/skills/register       -- Register a skill manifest
GET  /v1/skills                -- List registered skills
GET  /v1/skills/:name          -- Skill details
DELETE /v1/skills/:name        -- Revoke a skill
```

See [docs/api/overview.md](../../docs/api/overview.md) for full request/response schemas.

## Project Root

[Back to main README](../../README.md)
