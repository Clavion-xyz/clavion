# Quick Start

Get Clavion / ISCL running locally in under 5 minutes.

## Prerequisites

- Node.js >= 20
- npm >= 9
- Docker >= 24 (optional, for sandbox and Docker Compose stack)
- Anvil / Foundry (optional, for E2E tests and local Base fork)

## Local Development

```bash
# Clone the repository
git clone https://github.com/clavion/clavion.git
cd clavion

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the test suite
npm test

# Start the development server (hot-reload)
npm run dev
```

ISCL Core listens on `http://127.0.0.1:3100` by default.

## Verify

```bash
curl http://localhost:3100/v1/health
# {"status":"ok","version":"0.1.0","uptime":...}
```

## With Preflight Simulation

Preflight requires a Base RPC endpoint:

```bash
BASE_RPC_URL=https://mainnet.base.org npm run dev
```

## Docker Compose (Full Stack)

The Compose file lives at `docker/compose.yaml`. Run all commands from the repository root using the `-f` flag, or `cd docker/` first.

### Start ISCL Core + Anvil Base Fork

```bash
docker compose -f docker/compose.yaml up -d
```

By default, Anvil forks Base mainnet via `https://mainnet.base.org`. To use a different RPC provider (recommended for reliability), set the `BASE_FORK_RPC_URL` environment variable:

```bash
BASE_FORK_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY \
  docker compose -f docker/compose.yaml up -d
```

### Start the Full Demo Stack (ISCL Core + Anvil + OpenClaw)

The `demo` profile adds the OpenClaw agent container:

```bash
docker compose -f docker/compose.yaml --profile demo up -d
```

### Volume Persistence

The Compose stack uses named Docker volumes to persist data across restarts:

| Volume | Container Path | Contents |
|--------|---------------|----------|
| `keystore-data` | `/home/iscl/.iscl/keystore` | Encrypted keystore files |
| `audit-data` | `/home/iscl/.iscl/data` | Audit trace SQLite database |
| `openclaw-config` | `/home/node/.openclaw` | OpenClaw agent config (demo profile only) |

### Checking Logs

```bash
# Follow ISCL Core logs
docker compose -f docker/compose.yaml logs -f iscl-core

# Follow Anvil logs
docker compose -f docker/compose.yaml logs -f anvil

# Follow all services
docker compose -f docker/compose.yaml logs -f
```

### Stopping the Stack

```bash
# Stop containers but preserve volumes (keystore, audit DB, config)
docker compose -f docker/compose.yaml down

# Stop containers AND remove all volumes (full reset)
docker compose -f docker/compose.yaml down -v
```

## Next Steps

- [Dev Setup](development/dev-setup.md) -- Environment variables, policy configuration, Docker details
- [Configuration Reference](configuration.md) -- All configuration options in one place
- [API Reference](api/overview.md) -- All endpoints with examples
- [Testing Guide](development/testing.md) -- How to run each test category
- [Deployment Guide](operations/deployment.md) -- Production deployment, Docker, security hardening
