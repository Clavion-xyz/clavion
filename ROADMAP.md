# Roadmap

## v0.1 -- Core Runtime (current)

- Three-domain trust architecture (A/B/C)
- Encrypted keystore with scrypt + AES-256-GCM
- Policy engine with allowlists, rate limiting, value thresholds
- Transaction builders: transfer, approve, swap, native ETH
- Preflight simulation and risk scoring
- Human approval flow with single-use tokens
- Append-only audit trail (SQLite)
- Skill registry with manifest signing and static analysis
- Docker sandbox with seccomp enforcement
- OpenClaw adapter integration
- Fastify API with JSON Schema validation

## v0.2 -- Isolation & Multi-Wallet

- Rootless Podman as default sandbox runtime
- Multi-wallet support (multiple keystores, wallet profiles)
- Batched transaction execution
- CI/CD pipeline (GitHub Actions)
- Improved error diagnostics and structured error codes

## v0.3 -- Approval UI & Multi-Chain

- Web-based approval UI (replace readline prompt)
- Multi-chain support beyond Base (Ethereum mainnet, Arbitrum, Optimism)
- Webhook notifications for approval requests
- Policy versioning and migration tooling
- Enhanced audit log queries and export

## v1.0 -- Production Hardening

- Comprehensive security audit
- Stable public API with backward compatibility guarantees
- SDK for building ISCL-compatible skills
- CLI tool for keystore management, policy editing, and diagnostics
- Performance benchmarks and optimization
- Published documentation site
