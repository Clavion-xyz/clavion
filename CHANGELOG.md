# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] -- 2026-02-09

### Added
- Core ISCL runtime with 3-domain trust architecture (A: untrusted, B: trusted, C: limited trust)
- Encrypted keystore with scrypt + AES-256-GCM
- Policy engine with contract/token allowlists, rate limiting, and value thresholds
- Transaction builders for transfer, approve, swap, and native ETH transfers
- Preflight simulation with 7-rule additive risk scorer
- Human approval flow with single-use, TTL-bound approval tokens
- Append-only audit trail backed by SQLite, correlated by intentId
- Skill registry with ECDSA manifest signing and static analysis scanner
- Docker sandbox with seccomp enforcement (blocks fork/exec/spawn)
- OpenClaw adapter with thin skill wrappers and installer
- Fastify API server with full JSON Schema validation (AJV strict mode)
- Transaction broadcast with sign-and-send pipeline
- Balance lookup for ERC-20 tokens and native ETH
- Docker Compose stack (Anvil + ISCL Core + OpenClaw) with demo profile
- 339 unit, integration, security, and E2E tests
