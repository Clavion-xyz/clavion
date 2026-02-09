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

## API

- [API Reference](api/overview.md) -- All endpoints with curl examples, request/response schemas, error codes
- [Schema Specification](api/schemas.md) -- TxIntent v1 and SkillManifest v1 canonical schemas

## Integrations

- [OpenClaw Adapter Guide](integrations/openclaw.md) -- ISCLClient, skill wrappers, custom skill development
- [OpenClaw E2E Runbook](integrations/openclaw-e2e-runbook.md) -- Full integration walkthrough with Docker Compose

## Operations

- [Commands & Workflows](operations/commands-and-workflows.md) -- NPM scripts, Docker, API endpoints, demo scripts, troubleshooting

## Development

- [Quick Start](quickstart.md) -- Get running in under 5 minutes
- [Dev Setup](development/dev-setup.md) -- Prerequisites, environment variables, policy configuration
- [Repository Structure](development/repo-structure.md) -- Package layout and trust domain mapping
- [Testing Guide](development/testing.md) -- Test categories, commands, fixtures
- [Task Breakdown](development/task-breakdown.md) -- Epic/ticket breakdown with status
- [Implementation Roadmap](development/roadmap.md) -- Phase estimates and timeline
