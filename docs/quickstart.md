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

Start ISCL Core + Anvil Base fork:

```bash
docker compose up
```

Start the full demo stack (ISCL Core + Anvil + OpenClaw):

```bash
docker compose --profile demo up -d
```

## Next Steps

- [Dev Setup](development/dev-setup.md) -- Environment variables, policy configuration, Docker details
- [API Reference](api/overview.md) -- All endpoints with examples
- [Testing Guide](development/testing.md) -- How to run each test category
