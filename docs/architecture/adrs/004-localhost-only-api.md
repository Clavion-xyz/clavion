# ADR-004: Localhost-Only API

**Status:** Accepted
**Date:** 2025-02-01
**Deciders:** Architecture team

## Context

ISCL Core exposes an HTTP API that accepts transaction intents, returns approval tokens, and triggers signing operations. The fundamental question is: who should be able to reach this API?

The API surface is security-critical. It can:
- Trigger transaction signing (with valid approval tokens)
- Read wallet balances and transaction history
- Approve or deny pending transactions
- Register and manage skills
- Access audit trail data

If this API were exposed to the network, it would become a target for:

1. **Remote exploitation.** An attacker on the same network (or internet, if port-forwarded) could submit TxIntents directly, bypassing the agent entirely. While policy and approval would still apply, the attack surface expands dramatically.

2. **Man-in-the-middle on approval tokens.** Approval tokens are bearer tokens -- anyone who holds one can use it to trigger signing. If tokens traverse a network, they can be intercepted.

3. **Information disclosure.** Balance queries, audit trail data, and pending approval details contain sensitive financial information.

4. **Denial of service.** An exposed API can be flooded with requests, overwhelming the single-process ISCL Core.

### Deployment Model Implications

ISCL is designed as a **local runtime** -- it runs on the same machine as the AI agent, providing a secure signing service to co-located software. This is fundamentally different from a cloud API or shared service model.

The target users are:
- Individual operators running an AI agent on their workstation or VPS
- Development teams running agents in containerized environments (Docker Compose)
- Small-team deployments where agent and signer co-locate by design

These users benefit from zero-configuration security. They should not need to set up TLS certificates, API authentication, firewall rules, or network policies to get a secure deployment.

### Alternatives Considered

1. **Network-accessible API with authentication** -- Expose on `0.0.0.0` with API key or JWT auth. This would allow remote agents to connect to a shared ISCL Core. However, it introduces authentication management, token rotation, TLS certificate management, and a larger attack surface. For v0.1, this complexity is not justified.

2. **Unix domain socket** -- Bind to a filesystem socket instead of TCP. Provides strong access control via filesystem permissions. However, Docker networking does not natively support Unix sockets for inter-container communication, and the Fastify ecosystem has better-tested TCP support. Could be considered for v0.2.

3. **mTLS with client certificates** -- Mutual TLS ensures both parties are authenticated. Strong security but very high operational overhead: certificate generation, distribution, rotation, and CA management. Completely disproportionate for a localhost service.

## Decision

Bind the ISCL Core HTTP API exclusively to `127.0.0.1` (IPv4 loopback). Do not bind to `0.0.0.0` or any network-facing interface.

### Implementation Details

**Fastify listen configuration:**
```typescript
await server.listen({ host: "127.0.0.1", port: 3100 });
```

By binding to `127.0.0.1`, the operating system's TCP/IP stack ensures that only processes on the same machine can connect. No firewall configuration, TLS, or authentication is needed -- the OS enforces access control.

**Docker Compose networking:**

In the Docker Compose stack, services communicate through Docker's internal network. The ISCL Core service binds to `0.0.0.0` inside the container (to be reachable from other containers on the Docker network), but the port is only published to localhost on the host:

```yaml
ports:
  - "127.0.0.1:3100:3100"
```

This means the host machine can reach the API at `localhost:3100`, but the port is not exposed on any external network interface.

**No authentication required:**

Because only local processes can reach the API, the system does not implement request authentication (API keys, JWTs, cookies). This is a deliberate simplification. The approval flow provides human authorization for fund-affecting operations; the network binding provides access control.

The one exception is the approval token mechanism: `sign-and-send` requires a valid, single-use approval token. This is not authentication (it does not identify the caller) but authorization (it proves the operation was approved by a human).

### When Localhost-Only Is Insufficient

The localhost binding is appropriate for v0.1. Future versions may need network-accessible deployments for:

- **Remote agents connecting to a central signer** (e.g., multiple agents on different machines sharing one keystore)
- **Mobile approval workflows** (user approves from a phone, signer is on a server)
- **Multi-machine Docker Swarm or Kubernetes deployments**

These scenarios would require adding authentication, TLS, and rate limiting at the API level. The architecture supports this extension -- the Fastify server can be configured with additional middleware without changing the core signing pipeline.

## Consequences

### Positive

- **Zero-configuration security.** New deployments are secure by default. There is no "forgot to set up auth" failure mode. The OS enforces that only local processes can connect.
- **No credential management.** No API keys to rotate, no certificates to renew, no secrets to distribute. This eliminates an entire category of operational overhead and security risk.
- **Defense in depth with approval tokens.** Even if a local process submits malicious intents, it still needs a valid approval token (which requires human confirmation) to trigger signing. Localhost binding + approval tokens provide two independent access control layers.
- **Simple containerization.** Docker Compose uses standard port mapping (`127.0.0.1:3100:3100`) to maintain the localhost guarantee. No service mesh or overlay network configuration required.
- **Reduced attack surface.** Network-accessible APIs must defend against the full spectrum of network attacks: port scanning, brute force, DDoS, TLS downgrade, session hijacking. A localhost-only API faces none of these.

### Negative

- **Single-machine constraint.** The agent and ISCL Core must run on the same machine (or in the same Docker network). Remote agents cannot connect. This is the intended model for v0.1 but limits deployment flexibility.
- **No mobile approval without a proxy.** If the operator wants to approve transactions from a phone, they need a reverse proxy or VPN to reach the localhost API. The web approval UI is designed for same-machine browser access.
- **Cannot horizontally scale.** Multiple ISCL Core instances cannot share a load balancer because each is localhost-bound. Each instance manages its own keystore and audit trail independently.

### Neutral

- **Port 3100 is not well-known.** The default port does not conflict with common services (3000 is often used by development servers, 8080 by web servers). However, operators should verify it is available in their environment.
- **Docker networking requires awareness.** Inside Docker, "localhost" means the container itself, not the host. Services must use the Docker service name (`iscl-core`) or the container's internal IP to reach ISCL Core. This is standard Docker practice but can confuse newcomers.
- **Future migration path is clear.** Adding network authentication in v0.2+ would involve adding a Fastify middleware plugin. No changes to routes, handlers, or the signing pipeline are needed. The localhost-only decision does not create architectural debt.

## References

- [Deployment Guide](../../operations/deployment.md) -- Production deployment including Docker port mapping
- [Configuration Reference](../../configuration.md) -- `HOST` and `PORT` environment variables
- [Threat Model](../../architecture/threat-model.md) -- Network-level threat analysis
- [ADR-001: Trust Domain Isolation](001-trust-domain-isolation.md) -- Cross-domain communication via localhost HTTP
