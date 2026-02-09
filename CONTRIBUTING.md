# Contributing to Clavion / ISCL

Thank you for your interest in contributing. This guide covers the basics for getting started.

## Workflow

1. Fork the repository
2. Create a feature branch from `main`: `git checkout -b feat/your-feature`
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request against `main`

## Development Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/Clavion_project.git
cd Clavion_project

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Code Style

- **TypeScript** in strict mode (`strict: true` in tsconfig)
- **ESLint** + **Prettier** for formatting (config in repo root)
- No `any` types unless absolutely necessary and documented
- All schemas use `additionalProperties: false`

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

Examples:
- `feat(policy): add per-token rate limiting`
- `fix(wallet): handle keystore unlock timeout`
- `test(preflight): add edge cases for risk scorer`

## Project Structure

| Directory  | Purpose                                       |
| ---------- | --------------------------------------------- |
| `core/`    | ISCL Core services (Domain B -- trusted)      |
| `sandbox/` | Container runner and isolation (Domain C)     |
| `adapter/` | OpenClaw integration skills (Domain A)        |
| `spec/`    | JSON schemas, fixtures, canonicalization      |
| `tests/`   | Unit, integration, security, and E2E tests    |
| `scripts/` | Demo and utility scripts                      |
| `doc/`     | Specifications and design documents           |

## Trust Domain Boundaries

Every component belongs to exactly one trust domain. This is a hard architectural constraint:

- **Domain A (Untrusted):** Agent skills and adapters -- no keys, no signing, no direct RPC
- **Domain B (Trusted):** ISCL Core -- keys, policy, signing, audit, RPC access
- **Domain C (Limited Trust):** Sandbox -- no keys, communicates with Core via API only

New code must respect these boundaries. PRs that blur domain separation will be rejected.

## Testing Requirements

- All PRs must pass `npm test`
- New features require corresponding unit tests
- Security-sensitive changes require tests in `tests/security/`
- Test fixtures go in `spec/fixtures/`

## Security Considerations

- Never expose private keys outside Domain B
- Never add direct RPC calls to Domain A or C code
- Never bypass the policy engine or preflight checks
- See [SECURITY.md](SECURITY.md) for vulnerability reporting
