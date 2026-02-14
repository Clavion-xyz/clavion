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

### Building the Image

The Dockerfile is located at `docker/Dockerfile.core`. Build from the repository root so the build context includes all packages:

```bash
docker build -f docker/Dockerfile.core -t clavion-core .
```

### Running Standalone

Run the image directly with a Base RPC endpoint for preflight simulation:

```bash
docker run -p 3100:3100 -e BASE_RPC_URL=https://mainnet.base.org clavion-core
```

The image runs as non-root user `iscl` (created in the Dockerfile). Writable paths inside the container are:

| Path | Purpose |
|------|---------|
| `/home/iscl/.iscl/keystore` | Encrypted keystore files |
| `/home/iscl/.iscl/data` | Audit trace SQLite database |

To persist keystore and audit data across container restarts, mount volumes:

```bash
docker run -p 3100:3100 \
  -e BASE_RPC_URL=https://mainnet.base.org \
  -v iscl-keystore:/home/iscl/.iscl/keystore \
  -v iscl-audit:/home/iscl/.iscl/data \
  clavion-core
```

Or bind-mount to host directories (ensure the host directories are writable by UID that maps to `iscl` inside the container):

```bash
docker run -p 3100:3100 \
  -e BASE_RPC_URL=https://mainnet.base.org \
  -v ~/.iscl/keystore:/home/iscl/.iscl/keystore \
  -v ~/.iscl/data:/home/iscl/.iscl/data \
  clavion-core
```

### Docker Compose

Start ISCL Core + Anvil Base fork using the Compose file at `docker/compose.yaml`:

```bash
docker compose -f docker/compose.yaml up -d
```

Start the full demo stack (ISCL Core + Anvil + OpenClaw) with the `demo` profile:

```bash
docker compose -f docker/compose.yaml --profile demo up -d
```

To use a custom RPC provider for the Anvil fork:

```bash
BASE_FORK_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY \
  docker compose -f docker/compose.yaml up -d
```

See [Quick Start - Docker Compose](../quickstart.md#docker-compose-full-stack) for details on logs, volumes, and teardown.

## Environment Variables

> For a comprehensive reference of all configuration options, see [Configuration Reference](../configuration.md).

| Variable | Default | Description |
|---|---|---|
| `ISCL_PORT` | `3100` | HTTP listen port |
| `ISCL_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` in Docker) |
| `BASE_RPC_URL` | — | Base RPC endpoint for preflight simulation |
| `ISCL_AUDIT_DB` | `./iscl-audit.sqlite` | Path to audit SQLite database |
| `ISCL_KEYSTORE_PATH` | `~/.iscl/keystore` | Path to encrypted keystore directory |
| `ISCL_APPROVAL_MODE` | `cli` | Approval mode: `cli`, `web`, or `auto` |
| `ISCL_WALLET_ADDRESS` | -- | Default wallet address for adapters |
| `ISCL_RPC_URL_{chainId}` | -- | Per-chain RPC URLs (e.g., `ISCL_RPC_URL_1` for Ethereum) |
| `ONEINCH_API_KEY` | -- | 1inch Swap API key (optional, enables 1inch) |
| `TELEGRAM_BOT_TOKEN` | -- | Telegram bot token (for adapter-telegram) |
| `ISCL_TELEGRAM_ALLOWED_CHATS` | -- | Comma-separated allowed Telegram chat IDs |

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
