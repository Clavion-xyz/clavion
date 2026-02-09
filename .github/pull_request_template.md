## Summary

Brief description of the changes.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring (no functional change)
- [ ] Documentation
- [ ] Test coverage
- [ ] CI/CD or tooling

## Trust Domain

Which domains are affected?

- [ ] Domain A (Agent / Adapter)
- [ ] Domain B (ISCL Core)
- [ ] Domain C (Sandbox)
- [ ] None (docs, CI, tooling)

## Checklist

- [ ] All tests pass (`npm test`)
- [ ] New code has corresponding tests
- [ ] No `additionalProperties` left open in new schemas
- [ ] Trust domain boundaries are respected (no keys in A/C, no direct RPC in A/C)
- [ ] Commit messages follow `type(scope): description` convention
- [ ] Breaking changes are documented

## Security Review

- [ ] This PR does **not** touch Domain B (keystore, signing, policy)
- [ ] This PR touches Domain B and has been reviewed for security implications

## Additional Notes

Any context for reviewers.
