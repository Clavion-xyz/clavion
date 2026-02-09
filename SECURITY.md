# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Clavion / ISCL, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Email: **security@clavion.xyz**

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected component and trust domain (A, B, or C)
- Potential impact assessment

### Response timeline

- **48 hours**: acknowledgment of your report
- **7 days**: initial assessment and severity classification
- **30 days**: fix released or mitigation documented

### What qualifies as a security vulnerability

- Private key isolation bypass (Domain B keys exposed to Domain A or C)
- Sandbox escape (Domain C code accessing host resources)
- Policy engine bypass (transactions executed without passing policy evaluation)
- Approval token replay (single-use tokens accepted more than once)
- Audit log tampering (events deleted or modified after write)
- RPC access from untrusted domains (Domain A or C making direct blockchain calls)

### Bug bounty

A formal bug bounty program is coming soon. In the meantime, confirmed vulnerabilities will be acknowledged in the CHANGELOG and release notes with credit to the reporter (unless anonymity is requested).
