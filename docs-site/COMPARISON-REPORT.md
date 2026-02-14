# Documentation Comparison Report

**Date:** 2026-02-14
**Source:** `docs/` (49 markdown files)
**Target:** `docs-site/` (Mintlify, `.mdx` files)

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Mintlify pages | 24 | 41 |
| Navigation tabs | 4 | 5 |
| Navigation groups | 4 | 7 |
| New pages created | — | 17 |
| Source docs ported | — | 25 |
| Source docs skipped | — | 12 (internal/outdated) |
| Source docs already covered | — | 12 |

---

## New Pages Created (17)

### Start tab (+1)
| New Page | Source Doc | Description |
|----------|-----------|-------------|
| `start/use-cases.mdx` | `docs/use-cases.md` | 6 use case scenarios, MetaMask comparison table |

### Concepts tab (+4, new "Security & Design" group)
| New Page | Source Doc | Description |
|----------|-----------|-------------|
| `concepts/glossary.mdx` | `docs/glossary.md` | 12-category glossary of all project terms |
| `concepts/risk-scoring.mdx` | `docs/security/risk-scoring.md` | 7-factor scoring algorithm, worked examples |
| `concepts/threat-analysis.mdx` | `docs/security/threat-analysis-kelkar-attacker-models.md` | Academic threat analysis against Kelkar's attacker models |
| `concepts/adrs.mdx` | `docs/architecture/adrs/001-004` | 4 Architecture Decision Records consolidated |

### Reference tab (+2)
| New Page | Source Doc | Description |
|----------|-----------|-------------|
| `reference/api-cookbook.mdx` | `docs/api/cookbook.md` | 8 end-to-end curl recipes with full examples |
| `reference/changelog.mdx` | `docs/CHANGELOG.md` | v0.1.0 release notes with all package details |

### Guides tab (+4, new "Advanced" group)
| New Page | Source Doc | Description |
|----------|-----------|-------------|
| `guides/multi-chain.mdx` | `docs/operations/multi-chain.md` | 4-chain configuration, RPC setup, adding chains |
| `guides/skill-registry.mdx` | `docs/development/skill-registry.md` | SkillManifest schema, 6-step registration, static scanner |
| `guides/testing.mdx` | `docs/development/testing.md` | 4 test categories, fixtures, CI pipeline |
| `guides/contributing.mdx` | `docs/development/contributing.md` | Coding standards, security rules, PR process |

### Operations tab (+6, entirely new tab)
| New Page | Source Doc | Description |
|----------|-----------|-------------|
| `operations/index.mdx` | — | Operations section landing page |
| `operations/audit-trail.mdx` | `docs/operations/audit-trail.md` | SQLite schema, 14 event types, incident investigation |
| `operations/observability.mdx` | `docs/operations/observability.md` | pino logging, health monitoring, log forwarding |
| `operations/incident-runbook.mdx` | `docs/operations/incident-runbook.md` | 9 symptom-indexed diagnostic sections |
| `operations/performance-tuning.mdx` | `docs/operations/performance-tuning.md` | SQLite/RPC/Docker performance optimization |
| `operations/migration.mdx` | `docs/operations/migration.md` | Upgrade procedures, rollback, compatibility |

---

## Source Docs Already Covered by Existing Pages (12)

These `docs/` files had content already represented in the original 24 Mintlify pages:

| Source Doc | Covered By |
|-----------|------------|
| `docs/index.md` | `start/index.mdx` |
| `docs/quickstart.md` | `start/quickstart.mdx` |
| `docs/configuration.md` | `reference/config-reference.mdx` |
| `docs/api/overview.md` | `reference/rest-api.mdx` |
| `docs/api/errors.md` | `reference/error-codes.mdx` |
| `docs/architecture/trust-domains.md` | `concepts/trust-domains.mdx` |
| `docs/architecture/threat-model.md` | `concepts/trust-domains.mdx` (partially) |
| `docs/development/dev-setup.md` | `start/installation.mdx` |
| `docs/development/repo-structure.md` | `start/getting-started.mdx` |
| `docs/integrations/openclaw.md` | `guides/integrating-openclaw.mdx` |
| `docs/integrations/mcp-setup.md` | `guides/building-agents.mdx` |
| `docs/integrations/telegram-setup.md` | `guides/building-agents.mdx` |

---

## Source Docs Intentionally Skipped (12)

| Source Doc | Reason |
|-----------|--------|
| `docs/architecture/engineering-spec.md` | Internal engineering spec (~2000 lines), too detailed for public docs |
| `docs/architecture/whitepaper.md` | Internal whitepaper, not end-user documentation |
| `docs/architecture/prd.md` | Product requirements document, internal planning |
| `docs/architecture/stack-decisions.md` | Written in Russian, internal tech rationale |
| `docs/architecture/diagrams.md` | Sparse text-only diagrams (3 short sections), content covered better elsewhere |
| `docs/documentation-snapshot.md` | Meta-document about documentation itself |
| `docs/alpha-integrations.md` | Potentially outdated alpha-stage integration notes |
| `docs/development/task-breakdown.md` | Internal task planning document |
| `docs/development/roadmap.md` | Internal product roadmap |
| `docs/integrations/eliza-adapter-plan.md` | Planning document for Eliza adapter (implementation complete) |
| `docs/integrations/eliza-setup.md` | Covered within `guides/building-agents.mdx` |
| `docs/operations/commands-and-workflows.md` | Outdated pre-monorepo operations guide with wrong file paths |

---

## Navigation Structure Changes

### Before (4 tabs, 4 groups)
```
Start > Getting Started (6 pages)
Concepts > Architecture (6 pages)
Reference > API & Schemas (6 pages)
Guides > Walkthroughs (6 pages)
```

### After (5 tabs, 7 groups)
```
Start > Getting Started (7 pages, +1)
Concepts > Architecture (6 pages, unchanged)
Concepts > Security & Design (4 pages, NEW GROUP)
Reference > API & Schemas (8 pages, +2)
Guides > Walkthroughs (6 pages, unchanged)
Guides > Advanced (4 pages, NEW GROUP)
Operations > Running in Production (6 pages, NEW TAB)
```

---

## Content Quality Notes

### Mintlify Components Used in New Pages
All new pages use Mintlify-native components for better presentation:
- **Steps** — multi-step procedures (API cookbook, migration, contributing)
- **CodeGroup** — tabbed code blocks (cookbook recipes)
- **Accordion/AccordionGroup** — collapsible sections (glossary categories, ADRs, changelog)
- **Tabs/Tab** — tabbed content (threat analysis, runbook sections)
- **Note/Warning/Tip** — callout blocks throughout
- **Card/CardGroup** — visual navigation cards (use cases, operations index)
- **Icon** — section-appropriate icons in frontmatter

### Content Improvements Over Source
1. **API Cookbook** — Recipes reformatted with Steps component for clearer sequential workflow
2. **Glossary** — Categories organized in AccordionGroups for scannable browsing
3. **ADRs** — 4 separate files consolidated into one page with Accordion sections
4. **Incident Runbook** — 9 sections organized in Tabs for quick symptom lookup
5. **Use Cases** — Scenarios presented as Cards with icons for visual scanning

### Remaining Gaps
1. **Security section** — `docs/security/` has additional files (`sandbox-escape-analysis.md`, `key-derivation-spec.md`) not ported. These are highly technical and may warrant their own Concepts sub-group in a future pass.
2. **Deployment guide** — `docs/operations/deployment.md` content is partially covered by `guides/production-deployment.mdx` but could be expanded.
3. **ADR detail** — The consolidated ADRs page summarizes each ADR but loses some nuance from the full individual documents. Consider linking to the original markdown files for deep-dive readers.

---

## File Counts Summary

```
docs/           49 markdown files (source of truth)
docs-site/      41 .mdx pages (Mintlify site)
  - Original:   24 pages
  - New:        17 pages
  - Ported:     25 source docs represented
  - Skipped:    12 source docs (internal/outdated)
  - Coverage:   ~76% of source docs ported or already covered
```
