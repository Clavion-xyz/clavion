# ISCL Setup Guide

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 9
- **Docker** (optional, for containerized deployment and security tests)
- **Anvil** (optional, for E2E tests and local Base fork)

Install Anvil via Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Quick Start (Local)

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start ISCL Core
npm start
# Or with hot-reload:
npm run dev
```

ISCL Core listens on `http://127.0.0.1:3100` by default.

## Quick Start (Docker)

```bash
# Build image
docker build -t iscl-core:0.1.0-beta .

# Run standalone
docker run -p 3100:3100 iscl-core:0.1.0-beta

# Or with Anvil Base fork:
BASE_FORK_RPC_URL=https://mainnet.base.org docker compose up
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ISCL_PORT` | `3100` | HTTP listen port |
| `ISCL_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` in Docker) |
| `BASE_RPC_URL` | — | Base RPC endpoint for preflight simulation |
| `ISCL_AUDIT_DB` | `./iscl-audit.sqlite` | Path to audit SQLite database |
| `ISCL_KEYSTORE_PATH` | `~/.iscl/keystore` | Path to encrypted keystore directory |

## Policy Configuration

Create a JSON policy file and pass it via `ISCL_POLICY_PATH` (or inline in `AppOptions`):

```json
{
  "version": "1",
  "maxValueWei": "1000000000000000000000",
  "maxApprovalAmount": "1000000000000000000000",
  "contractAllowlist": ["0x2626664c2603336E57B271c5C0b26F421741e481"],
  "tokenAllowlist": [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x4200000000000000000000000000000000000006"
  ],
  "allowedChains": [8453],
  "recipientAllowlist": [],
  "maxRiskScore": 70,
  "requireApprovalAbove": { "valueWei": "10000000000000000000" },
  "maxTxPerHour": 100
}
```

## Running Tests

```bash
# All tests
npm test

# By category
npm run test:unit          # Unit tests (~225)
npm run test:integration   # Integration tests (~37)
npm run test:security      # Security tests (~28, some need Docker)

# E2E (requires Anvil + Base RPC)
BASE_RPC_URL=https://mainnet.base.org npm run test:e2e
```

## Verify Installation

```bash
curl http://localhost:3100/v1/health
# → {"status":"ok","version":"0.1.0","uptime":...}
```
