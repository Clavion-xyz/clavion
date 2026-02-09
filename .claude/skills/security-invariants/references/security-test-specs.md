# Security Test Specifications

## Domain A Tests (OpenClaw / Skills)

### SecurityTest_A1: SkillKeyExfiltration
Launch a test "evil-skill" in the OpenClaw environment that attempts:
- Read `~/.ssh/`, `~/.config/`, `~/.iscl/keystore/`
- Read all environment variables
- Call guessed API endpoints for key extraction
Expected: keys are missing, access errors, attempts recorded in audit trace.
Separately verify: signing is impossible without policy + approval.

### SecurityTest_A2: NoExternalNetworkFromSkill
Skill attempts HTTP/HTTPS requests to arbitrary external domains.
Expected: blocked, logged, execution denied.

### SecurityTest_A3: ApprovalSummarySourceOfTruth
Skill sends TxIntent "swap 1 USDC" but attempts to spoof the approval summary text.
Expected: ApprovalRequest text and details correspond to build/preflight data, not skill input. Spoofing has no effect on what user sees.

### SecurityTest_A4: PolicyDeniesBadIntents
Test cases:
- `approve` for MaxUint without policy permission → deny
- `transfer` to disallowed address → deny
- `swap` via unknown router not in contractAllowlist → deny
- Action type not in skill's declared permissions → deny
Expected: deny with reason code, `policy_denied` event in audit trace.

## Domain C Tests (Secure Executor)

### SecurityTest_C1: ExecutorCannotReadKeys
Run malicious package in sandbox that attempts:
- Read key material from filesystem
- Read key material from environment
- Access ISCL Core internal endpoints
Expected: keys absent, attempts recorded, signing impossible without approval.

### SecurityTest_C2: NetworkAllowlist
From within sandbox, attempt requests to domains outside the allowlist.
Expected: blocked, written to audit trace.

### SecurityTest_C3: NoSpawnNoMine
Attempts from sandbox:
- Spawn `bash`, `curl`, `node -e "download..."`
- CPU burn (crypto miner pattern)
Expected: spawn denied (with `no_spawn`), CPU burn stopped by cgroup limits, events in trace.

### SecurityTest_C4: TamperedPackageRejected
- Modify one file in signed package → sha256 mismatch → installation forbidden
- Modify manifest after signing → signature invalid → installation forbidden

## Domain B Tests (ISCL Core)

### SecurityTest_B1: RpcMismatchElevatesRisk
Mock two RPCs returning different simulation results.
Expected: risk score elevated, approval requires confirmation, mismatch recorded in trace.

### SecurityTest_B2: NoBypassSigning
Attempt to call WalletService.sign without valid PolicyDecision + ApprovalToken.
Expected: 403/deny. Verify all signatures in logs have `policy_allowed` + `approval_used` events.

### SecurityTest_B3: ApprovalTokenSingleUse
Use approvalToken once (success), then attempt reuse.
Expected: second use refused. Also: repeat sign-and-send with same intentId after sending → "already sent" or refusal.

### SecurityTest_B4: ApprovalBounded
TxIntent with `approve` amount exceeding policy `maxApprovalAmount` → deny.
Swap workflow requiring approve → TxEngine builds approve for bounded amount, not MaxUint.
