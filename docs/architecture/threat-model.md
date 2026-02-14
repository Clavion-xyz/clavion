--- START OF FILE ISCL Security Blueprint v0.1.md ---

# ISCL Security Blueprint v0.1
(Threat → Mitigation → Component → Test)

This document captures the threat model for the "Independent Secure Crypto Layer compatible with OpenClaw" (ISCL) and links every threat to specific mitigations, components, and tests. The goal of v0.1 is not "absolute security," but provable invariants: keys are isolated, signatures are controlled by policies, and malicious skills cannot silently exfiltrate data or send arbitrary transactions.

> See also: [Risk Scoring Algorithm](../security/risk-scoring.md) for the 7-factor scoring system used in preflight simulation.

## 0. Trust Boundaries and Invariants v0.1

We divide the system into three trust domains.

Domain A: OpenClaw + ecosystem skills. Considered potentially compromisable. No keys, no direct signing/transactions, and no arbitrary network requests are allowed from this domain.

Domain B: ISCL Core. The trusted domain for key storage, policy decision-making, and transaction signing.

Domain C: Secure Executor (container/nanokernel). An untrusted/limited-trust domain where external crypto-skills or computational parts are executed. Domain C has no access to keys; it can only request operations via the ISCL API.

Invariants v0.1:
1) The private key is never available in Domain A or C. It is available only in Domain B.
2) Any transaction signature passes through the PolicyEngine and Preflight; if confirmation mode is enabled, it requires human approval.
3) OpenClaw skills do not have direct RPC access to the blockchain; only ISCL Core can access RPC via an allowlist.
4) Any operation that can lead to a loss of funds is expressed as a TxIntent v1 and validated against a schema; arbitrary calldata is not signed in v0.1.
5) All critical steps are written to the AuditTrace with correlation: intentId → preflight → approval → signature → txHash → receipt.

## 1. Domain A Threats (OpenClaw/skills) and Mitigations

### T1. Malicious skill attempts to steal the private key (read env/filesystem, keylogger, scripts)
Mitigation: Keys are physically not present in Domain A; OpenClaw skills do not receive secrets. All signing occurs in the WalletService of Domain B. There is no API in Domain A to extract the key, only a request to "sign txRequest" after policies and approval.

Components: WalletService, OpenClaw Adapter (thin clients), Config Manager.

Test: SecurityTest_A1 "SkillKeyExfiltration".
Launch a test "evil-skill" in the OpenClaw environment that attempts to read standard paths (~/.ssh, ~/.config, env vars) and calls guessed APIs. Expectation: keys are missing, access error, attempts are recorded in the trace. Separately verify that signing is impossible without policy+approval.

### T2. Malicious skill attempts to make an arbitrary network request (exfiltration, payload download, C2 communication)
Mitigation: Domain A has no network permissions for crypto operations; crypto-skills only communicate with the localhost ISCL API. In Domain C, the network is allowlist_only; in Domain B, there is an egress allowlist for RPC/simulation. Any other domains are blocked.

Components: Sandbox Runner (for Domain C), OpenClaw skill packaging policy (for Domain A), NetworkPolicy.

Test: SecurityTest_A2 "NoExternalNetworkFromSkill".
Skill attempts to make a request to an arbitrary domain. Expectation: blocked, logged, execution denied.

### T3. Skill attempts to deceive the user via UI (semantic spoofing, misleading summary)
Mitigation: Human approval is not shown from the skill but is formed by ISCL Core based on the BuildPlan+Preflight. The skill does not control the confirmation text. ApprovalRequest is formed from canonical data: to, contract, method signature, token amounts, slippage, expected balance diffs.

Components: TxEngine, PreflightService, ApprovalComposer.

Test: SecurityTest_A3 "ApprovalSummarySourceOfTruth".
Skill sends a TxIntent "swap 1 USDC" but attempts to spoof the summary. Expectation: in the ApprovalRequest, the text and details correspond to build/preflight, not the skill input; spoofing has no effect.

### T4. Skill generates TxIntent with harmful parameters (huge approve, recipient spoofing, swap on unknown contract)
Mitigation: Strict TxIntent schema + PolicyEngine. Policy blocks unknown contracts, exceeding maxApprovalAmount, exceeding maxValueWei, and mismatches in tokenAllowlist/contractAllowlist. Preflight adds warnings and raises risk for anomalies.

Components: TxIntent validator, PolicyEngine, PreflightService.

Test: SecurityTest_A4 "PolicyDeniesBadIntents".
A set of cases: approve for MaxUint without permission, transfer to a disallowed address, swap via an unknown router. Expectation: deny with reason code; policy_denied event recorded in audit trace.

## 2. Domain C Threats (Secure Executor) and Mitigations

### T5. Malicious crypto-skill in Domain C attempts to gain access to keys
Mitigation: Keys are absent in Domain C. The only pathway is to request a signature via the ISCL API, but this request passes policy and may require approval. Any attempts to read key material are impossible.

Components: WalletService (B), Sandbox FS isolation (C), IPC boundary.

Test: SecurityTest_C1 "ExecutorCannotReadKeys".
Run a malicious package in the sandbox and attempt to find keys on the FS and in env. Expectation: absent; attempts recorded; signing impossible without approval.

### T6. Skill in Domain C attempts to access the internet and download malicious payload / exfiltrate data
Mitigation: Network is allowlist_only. Only specific RPC endpoints are allowed (if necessary) or generally "none" for most skills, as the network should belong to ISCL Core. Any external domains are blocked.

Components: Sandbox Runner network policy.

Test: SecurityTest_C2 "NetworkAllowlist".
Attempt requests to domains outside the allowlist → block + write to trace.

### T7. Skill attempts to execute arbitrary processes/mining/DoS
Mitigation: no_spawn or whitelisted_spawn, cgroups limits, timeouts. Crypto miners and any binaries outside the allowlist are prohibited.

Components: Sandbox Runner process policy, resource limits.

Test: SecurityTest_C3 "NoSpawnNoMine".
Attempt to spawn "bash", "curl", "node -e download" with no_spawn → denial. Attempt CPU burn → stop by limits and trace.

### T8. Supply chain attack: substitution of skill package or dependency
Mitigation: Signed Skill Package + manifestHash/sourceHash + verify on installation. Lockfile is mandatory. In the absence of a signature or hash mismatch, installation is blocked or requires an explicit override.

Components: SkillRegistryService, Installer, Scanner.

Test: SecurityTest_C4 "TamperedPackageRejected".
Change one file in the package → sha256 mismatch → installation forbidden. Change manifest after signing → signature invalid.

## 3. Domain B Threats (ISCL Core) and Mitigations

### T9. RPC endpoint compromised and returns false data (spoofed simulation, price, balance)
Mitigation: Allowlist of trusted RPCs + capability to use two independent RPCs for comparison (v0.1 as an optional mode). Any simulation is tagged "source=rpcX". On discrepancies, the system raises risk and may demand confirmation.

Components: RpcClient, PreflightService.

Test: SecurityTest_B1 "RpcMismatchElevatesRisk".
Mock two RPCs: one returns a different result. Expectation: risk elevated, approval requires confirmation, trace records mismatch.

### T10. Policy bypass via undocumented signing path
Mitigation: WalletService signs only via a single method requiring PolicyDecision + ApprovalToken. No direct "signRaw". Internal APIs are closed. All signatures are logged.

Components: WalletService, PolicyEngine, ApprovalTokenManager.

Test: SecurityTest_B2 "NoBypassSigning".
Attempt to call internal signing endpoint without approval → 403/deny. Verify that all signatures are accompanied by policy_allowed + approval_used trace events.

### T11. Replay attack: reuse of approvalToken / intentId
Mitigation: approvalToken is single-use, bound to intentId and a specific txRequestHash, and has a TTL. intentId is idempotent: repeated build returns the same plan or reports "intent already consumed" after sending.

Components: IdempotencyStore, ApprovalTokenManager, TxEngine.

Test: SecurityTest_B3 "ApprovalTokenSingleUse".
Use approvalToken a second time → refusal. Repeat sign-and-send with the same intentId after sending → refusal or "already sent" returning the txHash.

### T12. Excessively broad approvals (MaxUint allowances) lead to fund loss risk
Mitigation: Policy maxApprovalAmount + preference for "exact approval" or "bounded approval". Preflight shows allowance change and warns. By default, maxApprovalAmount is restricted.

Components: TxEngine (approve builder), PolicyEngine, ApprovalComposer.

Test: SecurityTest_B4 "ApprovalBounded".
TxIntent approve with amount > policy limit → deny. Swap workflow requires approve → TxEngine builds approve for bounded amount.

## 4. User Threats/Social Engineering and v0.1 Limitations

### T13. User approves harmful transaction themselves (social engineering)
Mitigation: Show clear approval summary + risk score + balance diffs. However, cannot be fully prevented.

Components: ApprovalComposer, UI/CLI approval.

Test: UXTest_1 "ApprovalClarity".
Check for mandatory fields in approval: asset in/out, minOut/maxIn, spender/recipient, risk reasons.

Limitation v0.1: If the user explicitly approves, the system will execute the action within policy limits. Policy is the main barrier.

### T14. User OS Compromise / Rootkit
Limitation: Out of scope v0.1. Can lower risk via hardware wallet or remote signer (v0.2).

## 5. Test Matrix and "Definition of Secure Enough" for Pilot

For the v0.1 pilot, the system is considered "secure enough" if:
1) SecurityTest_A1..A4, C1..C4, B1..B4 pass in CI.
2) Any signature in logs has the linkage: intentId → policyAllowed → preflight → approval → sign → send.
3) With human approval enabled, it is impossible to send a tx without manual confirmation.
4) Access to the network outside the allowlist and FS outside allowedPaths is impossible within the sandbox.

## 6. Mandatory Logs and Events (Audit Trace v0.1)

AuditTrace must capture:
intent_received (intentId, skillId, openclawVersion, createdAt)
policy_evaluated (decision, reasons, policyVersion)
build_completed (txRequestHash, to, value, methodSig)
preflight_completed (riskScore, balanceDiffsSummary, warnings)
approval_issued (approvalTokenId, ttl)
signature_created (txRequestHash, signerId)
tx_sent (txHash, chainId)
tx_receipt (status, gasUsed)
security_violation (type, details) for sandbox events

These events are necessary for investigations and future reputation/attestations.

## 7. Roadmap for Security Upgrades (Post-Pilot)

v0.2 will add: session keys/allowances, smart accounts, multi-RPC consensus, stricter sandbox (WASM/Firecracker/ Nanoclaw executor), package signing with attestation, and optional private relay integration.