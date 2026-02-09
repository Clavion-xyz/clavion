# Governance

## Model

Clavion / ISCL uses a **Benevolent Dictator For Now (BDFN)** governance model. A single maintainer has final decision authority on all project matters. This model is appropriate for the current stage of the project and will evolve as the contributor base grows.

## Decision Process

- **Routine changes** (bug fixes, tests, docs): one approving review required
- **Security-critical changes** (Domain B, policy engine, keystore, signing): two approving reviews required
- **Breaking changes** (API, schema, trust boundary modifications): must be discussed in a GitHub Issue before implementation
- **Architectural changes** (new trust domains, new external dependencies): require a design document in `doc/` and maintainer approval

## Contributions

All contributors are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Conflict Resolution

If a disagreement cannot be resolved through discussion on a PR or Issue, the maintainer makes the final call. Decisions will be documented in the relevant Issue or PR for transparency.

## Evolution

As the project matures and gains contributors, governance will transition toward a multi-maintainer model with defined roles. Changes to governance will be proposed via PR to this file.
