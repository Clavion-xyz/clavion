# Deployment Guide

Production deployment, security hardening, and operational best practices for ISCL Core.

## Deployment Architectures

ISCL Core supports three deployment models, each suited to different stages of the project lifecycle.

### 1. Local Daemon

The simplest option for development. Run ISCL Core directly on a single machine:

```bash
npm run dev    # Development mode with auto-reload
npm start      # Production mode
```

ISCL Core listens on `localhost:3100`. Adapters (MCP, Telegram, OpenClaw) run as separate processes on the same host and communicate with Core over HTTP.

### 2. Docker Standalone

A single container built from `docker/Dockerfile.core`. The image uses a multi-stage build: Node 20 Alpine as the builder stage, then a slim production runtime with a non-root `iscl` user (UID 1001). Exposes port 3100. Keystore and audit database are mounted as named Docker volumes for persistence.

### 3. Docker Compose

A 3-service stack defined in `docker/compose.yaml`:

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `anvil` | `ghcr.io/foundry-rs/foundry` | 8545 | Local blockchain fork |
| `iscl-core` | Built from `Dockerfile.core` | 3100 | ISCL Core, depends on anvil |
| `openclaw` | OpenClaw agent | 18789 | Demo profile only |

Named volumes: `keystore-data`, `audit-data`, `openclaw-config`.

### Production Architecture

For production deployments, place ISCL Core behind a reverse proxy (nginx, caddy, or traefik) for TLS termination. ISCL Core itself does not handle TLS.

```
Internet --> [Reverse Proxy (TLS)] --> [ISCL Core :3100]
                                            |
                                       [RPC Providers]
                                       (Alchemy, Infura, etc.)
```

## Docker Production Setup

### Building the Image

```bash
docker build -f docker/Dockerfile.core -t clavion-core .
```

The Dockerfile is multi-stage:

- **Builder stage**: Full Node 20 Alpine, `npm ci`, `npm run build`
- **Runtime stage**: Slim Node 20 Alpine, copies only `dist/` and `node_modules`, runs as non-root `iscl` user

### Running the Container

```bash
docker run -d \
  --name iscl-core \
  -p 3100:3100 \
  -e ISCL_HOST=0.0.0.0 \
  -e ISCL_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY \
  -e ISCL_APPROVAL_MODE=web \
  -v keystore-data:/home/iscl/.iscl/keystore \
  -v audit-data:/home/iscl/.iscl/data \
  clavion-core
```

Key points:

- `ISCL_HOST=0.0.0.0` is required inside Docker. The default `127.0.0.1` will not accept connections from outside the container network.
- Volume mounts persist keystore and audit data across container restarts.
- Never use `ISCL_AUTO_APPROVE=true` or `ISCL_APPROVAL_MODE=auto` in production.

### Docker Compose (Full Stack)

```bash
# ISCL Core + Anvil
docker compose -f docker/compose.yaml up -d

# With OpenClaw demo agent
docker compose -f docker/compose.yaml --profile demo up -d
```

## Security Hardening

### Network Security

- **Bind to localhost**: The default `ISCL_HOST=127.0.0.1` prevents external access. Only change this inside Docker where a container network provides isolation.
- **TLS termination**: Place nginx, caddy, or traefik in front of ISCL Core. Example nginx configuration:

  ```nginx
  server {
      listen 443 ssl;
      server_name iscl.yourdomain.com;
      ssl_certificate /etc/ssl/certs/iscl.pem;
      ssl_certificate_key /etc/ssl/private/iscl.key;
      location / {
          proxy_pass http://127.0.0.1:3100;
          proxy_set_header Host $host;
      }
  }
  ```

- **Firewall**: Only adapters should reach ISCL Core. Block all other inbound traffic to port 3100.
- **Never expose ISCL Core directly to the internet** -- it has no authentication layer.

### Keystore Security

- **File permissions**: Set `600` for encrypted key files, `700` for the keystore directory.
- **Strong passphrases**: The keystore uses scrypt (N=2^18) + AES-256-GCM. Use a strong, unique passphrase.
- **Backup encrypted files**: Back up the keystore directory regularly. Files are encrypted at rest -- plaintext keys never touch disk.
- **Key rotation**: Generate new keys periodically. Old keys can remain in the keystore but should be decommissioned.

### Process Security

- **Non-root user**: The Docker image runs as `iscl` (UID 1001), never root.
- **Drop capabilities**: Use `--cap-drop ALL` in Docker for minimal privileges.
- **Read-only root**: Consider `--read-only` with tmpfs for `/tmp`.
- **Approval mode**: Use `web` or `cli` in production. **Never** use `auto` -- it approves all transactions without confirmation.

### Sandbox Security (Domain C)

When running sandboxed skills, containers are isolated with:

- `--network none` -- no internet access
- `--read-only` root filesystem
- `--cap-drop ALL`
- `--security-opt no-new-privileges`
- Memory and CPU limits from skill manifest

## RPC Provider Configuration

Configure one or more RPC endpoints for blockchain access:

```bash
# Single chain (Base)
ISCL_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Multi-chain
ISCL_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ISCL_RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
ISCL_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
ISCL_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

Recommendations:

- Use authenticated RPC providers (Alchemy, Infura, QuickNode) for reliability.
- Public endpoints may rate-limit or return stale data.
- Consider provider redundancy (different providers for different chains).
- Monitor RPC credits and rate limits.

See [Multi-Chain Operations](multi-chain.md) for detailed chain configuration.

## Backup and Recovery

### What to Back Up

| Data | Path | Frequency | Notes |
|------|------|-----------|-------|
| Encrypted keystore | `~/.iscl/keystore/` or Docker volume | After each key import/generation | Contains encrypted private keys -- loss means loss of signing capability |
| Audit database | `./iscl-audit.sqlite` or Docker volume | Daily | Append-only transaction history |
| Policy config | Your policy JSON file | After changes | Can be regenerated from version control |

### Restore Procedure

1. Stop ISCL Core.
2. Restore keystore files to the keystore directory.
3. Restore audit SQLite file to the configured path.
4. Restart ISCL Core -- it picks up the restored data automatically.

SQLite uses WAL mode. If restoring from a backup, ensure both the `.sqlite` and `.sqlite-wal` files are copied together.

## Monitoring

### Health Check

```bash
curl http://localhost:3100/v1/health
# { "status": "ok", "version": "0.1.0", "uptime": 12345 }
```

Poll every 30 seconds. Alert on non-200 responses or missing responses.

### Structured Logging

ISCL Core uses pino for JSON-structured logs:

```json
{"level":30,"time":1707500000000,"msg":"Server listening","address":"127.0.0.1","port":3100}
```

Forward to your log aggregation tool (ELK, Loki, CloudWatch). See [Observability Guide](observability.md) for details.

### Key Metrics

| Metric | Source | Alert When |
|--------|--------|------------|
| Health status | `GET /v1/health` | Non-200 or timeout |
| Transaction throughput | Audit events per minute | Unusual spikes |
| Policy denial rate | `policy_evaluated` events with decision=deny | Higher than expected |
| Signing errors | `signing_denied` audit events | Any occurrence |
| RPC errors | 502 responses from API | Persistent failures |
| Approval latency | Time between `approve_request_created` and `web_approval_decided` | > 5 minutes |

## Updating

1. Stop the running instance or container.
2. Pull latest code or rebuild Docker image: `docker build -f docker/Dockerfile.core -t clavion-core .`
3. Restart with the same volume mounts -- data is preserved.
4. Verify: `curl http://localhost:3100/v1/health`

For Docker Compose:

```bash
docker compose down && docker compose build && docker compose up -d
```

See [Migration Guide](migration.md) for schema changes between versions.

## Related Documentation

- [Configuration Reference](configuration.md) -- environment variables and policy options
- [Multi-Chain Operations](multi-chain.md) -- chain-specific RPC and routing setup
- [Observability Guide](observability.md) -- logging, metrics, and alerting in detail
- [Migration Guide](migration.md) -- upgrade procedures and schema migration
