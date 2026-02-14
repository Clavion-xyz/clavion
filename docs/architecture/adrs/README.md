# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Clavion/ISCL project. ADRs document significant architectural decisions, their context, and consequences.

## Format

Each ADR follows a lightweight MADR-inspired format:
- **Title** -- Short descriptive name
- **Status** -- Proposed, Accepted, Deprecated, Superseded
- **Context** -- Problem statement and forces at play
- **Decision** -- What was decided and why
- **Consequences** -- Positive, negative, and neutral outcomes

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-trust-domain-isolation.md) | Trust Domain Isolation | Accepted | 2025-02-01 |
| [002](002-sqlite-audit-trail.md) | SQLite for Audit Trail | Accepted | 2025-02-01 |
| [003](003-txintent-declarative-format.md) | TxIntent Declarative Format | Accepted | 2025-02-01 |
| [004](004-localhost-only-api.md) | Localhost-Only API | Accepted | 2025-02-01 |

## Creating a New ADR

1. Copy the template below
2. Number sequentially (e.g., `005-descriptive-name.md`)
3. Fill in all sections
4. Submit via PR for review
5. Update the index table above

## Template

```markdown
# ADR-NNN: Title

**Status:** Proposed
**Date:** YYYY-MM-DD
**Deciders:** (list of people or teams involved)

## Context

Describe the problem, the forces at play, and why a decision is needed.

## Decision

State the decision and the rationale behind it.

## Consequences

### Positive
- (benefits of this decision)

### Negative
- (costs, trade-offs, or risks introduced)

### Neutral
- (side effects that are neither clearly positive nor negative)

## References
- (links to related documents, ADRs, or external resources)
```
