# Clavion / ISCL Documentation

**Independent Secure Crypto Layer** -- a local secure runtime that enables AI agents to safely perform crypto operations while isolating private keys from untrusted agent code.

---

## Architecture

- [Architecture Overview](architecture/overview.md) -- Three trust domains, component map, data flow
- [Trust Domains](architecture/trust-domains.md) -- Domain A (Untrusted), Domain B (Trusted), Domain C (Limited Trust)
- [Engineering Specification](architecture/engineering-spec.md) -- Master technical spec for ISCL v0.1
- [Whitepaper](architecture/whitepaper.md) -- Full product whitepaper with market context and security analysis
- [Threat Model & Security Blueprint](architecture/threat-model.md) -- Threat-to-mitigation-to-test mapping
- [Stack Decisions](architecture/stack-decisions.md) -- Technology stack rationale
- [Product Requirements (PRD)](architecture/prd.md) -- Functional requirements and success criteria
- [Architecture Decision Records](architecture/adrs/README.md) -- ADR index and format guide
  - [ADR-001: Trust Domain Isolation](architecture/adrs/001-trust-domain-isolation.md)
  - [ADR-002: SQLite for Audit Trail](architecture/adrs/002-sqlite-audit-trail.md)
  - [ADR-003: TxIntent Declarative Format](architecture/adrs/003-txintent-declarative-format.md)
  - [ADR-004: Localhost-Only API](architecture/adrs/004-localhost-only-api.md)

## Configuration

- [Configuration Reference](configuration.md) -- All environment variables, policy config, AppOptions

## API

- [API Reference](api/overview.md) -- All endpoints with curl examples, request/response schemas, error codes
- [API Cookbook](api/cookbook.md) -- End-to-end curl workflows for common operations
- [Error Catalog](api/errors.md) -- Complete HTTP error reference for every endpoint
- [Schema Specification](api/schemas.md) -- TxIntent v1 and SkillManifest v1 canonical schemas

## Security

- [Risk Scoring Algorithm](security/risk-scoring.md) -- 7-factor scoring, constants, worked examples
- [Threat Model & Security Blueprint](architecture/threat-model.md) -- Threat-to-mitigation-to-test mapping

## Integrations

- [OpenClaw Adapter Guide](integrations/openclaw.md) -- ISCLClient, skill wrappers, custom skill development
- [OpenClaw E2E Runbook](integrations/openclaw-e2e-runbook.md) -- Full integration walkthrough with Docker Compose
- [MCP Adapter Setup](integrations/mcp-setup.md) -- Claude Desktop, Cursor, and IDE integration
- [Eliza (ElizaOS) Integration](integrations/eliza-setup.md) -- Plugin setup, character config, action reference
- [Telegram Bot Setup](integrations/telegram-setup.md) -- Bot creation, commands, inline approval

## Operations

- [Commands & Workflows](operations/commands-and-workflows.md) -- NPM scripts, Docker, API endpoints, demo scripts, troubleshooting
- [Deployment Guide](operations/deployment.md) -- Production deployment, Docker, security hardening
- [Multi-Chain Operations](operations/multi-chain.md) -- Supported chains, RPC configuration, chain routing
- [Audit Trail Guide](operations/audit-trail.md) -- Event types, querying, incident investigation
- [Observability Guide](operations/observability.md) -- Logging, monitoring, alerting, log forwarding
- [Migration Guide](operations/migration.md) -- Versioning strategy, upgrade procedures, rollback
- [Performance Tuning](operations/performance-tuning.md) -- SQLite tuning, RPC optimization, throughput
- [Incident Runbook](operations/incident-runbook.md) -- Symptom-indexed diagnosis and resolution

## Development

- [Quick Start](quickstart.md) -- Get running in under 5 minutes
- [Dev Setup](development/dev-setup.md) -- Prerequisites, environment variables, policy configuration
- [Repository Structure](development/repo-structure.md) -- Package layout and trust domain mapping
- [Testing Guide](development/testing.md) -- Test categories, commands, fixtures
- [Adapter Development Tutorial](development/adapter-tutorial.md) -- Build a new Domain A adapter step-by-step
- [Sandbox Skill Development](development/sandbox-skill-development.md) -- Write, test, and deploy sandboxed skills
- [Skill Registry Workflow](development/skill-registry.md) -- Manifest creation, registration pipeline, API
- [Contributing Guide](development/contributing.md) -- PR process, coding standards, security rules
- [Task Breakdown](development/task-breakdown.md) -- Epic/ticket breakdown with status
- [Implementation Roadmap](development/roadmap.md) -- Phase estimates and timeline

## Reference

- [Changelog](CHANGELOG.md) -- Version history (Keep a Changelog format)
- [Glossary](glossary.md) -- Definitions of key terms and concepts
- [Documentation Snapshot](documentation-snapshot.md) -- System overview and documentation coverage
