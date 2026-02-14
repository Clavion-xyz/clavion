# Incident Runbook

Symptom-indexed guide for diagnosing and resolving common ISCL operational issues.

---

## How to Use This Runbook

1. Find the symptom that matches what you're observing
2. Follow the diagnosis steps in order
3. Apply the recommended resolution
4. Check the audit trail for root cause analysis

All SQL queries reference the SQLite audit database (default: `~/.iscl/audit.sqlite`).

---

## Symptom: Unauthorized Transaction Executed

**Severity:** Critical
**Description:** Funds moved to an unexpected address or an unexpected amount was transferred.

### Diagnosis

**1. Find the transaction in the audit trail:**

```sql
SELECT * FROM audit_events
WHERE event = 'signed'
ORDER BY timestamp DESC
LIMIT 10;
```

**2. Reconstruct the full intent lifecycle:**

```sql
SELECT event, timestamp, data FROM audit_events
WHERE intent_id = '<the-intent-id>'
ORDER BY timestamp ASC;
```

Look for:
- `intent_received` -- Who submitted the intent? Check `data.source` for the adapter name.
- `policy_evaluated` -- Was the policy decision `allow` or `require_approval`? If `allow`, the policy threshold was too permissive.
- `approval_requested` / `approval_decided` -- Was user confirmation required? Was it actually confirmed by the operator?
- `signed` -- The signing event with the transaction hash.
- `broadcast` -- Was the transaction successfully broadcast?

**3. Check if the approval was legitimate:**

```sql
SELECT data FROM audit_events
WHERE intent_id = '<the-intent-id>'
  AND event = 'approval_decided';
```

If `approved: true` but the operator did not authorize it, check:
- Was `ISCL_APPROVAL_MODE=auto`? This bypasses human confirmation.
- Was the approval submitted via the web API by an unauthorized party?
- Was the approval TTL exploited (approved just before expiry)?

### Resolution

1. **Immediately** -- Rotate the wallet if compromise is suspected. Generate a new key and transfer remaining assets.
2. **Review policy** -- Lower `requireApprovalAbove.valueWei` to require approval for smaller amounts.
3. **Check approval mode** -- Ensure production is NOT running with `ISCL_APPROVAL_MODE=auto`.
4. **Restrict access** -- If using web approval, ensure the `/approval-ui` endpoint is only accessible to authorized operators.

---

## Symptom: All Transactions Being Denied

**Severity:** Medium
**Description:** Every transaction attempt returns HTTP 403 with policy denial.

### Diagnosis

**1. Check the policy denial reasons:**

```sql
SELECT data FROM audit_events
WHERE event = 'policy_evaluated'
  AND json_extract(data, '$.decision') = 'deny'
ORDER BY timestamp DESC
LIMIT 5;
```

**2. Common denial reasons and fixes:**

| Reason | Cause | Fix |
|--------|-------|-----|
| `"value exceeds max"` | `maxValueWei` is too low (default `"0"`) | Increase `maxValueWei` in policy config |
| `"chain not allowed"` | Chain ID not in `allowedChains` | Add the chain ID to `allowedChains` |
| `"token not in allowlist"` | Token address not in `tokenAllowlist` | Add the token or clear the allowlist (empty = allow all) |
| `"recipient not in allowlist"` | Recipient not in `recipientAllowlist` | Add the recipient or clear the allowlist |
| `"contract not in allowlist"` | Target contract not in `contractAllowlist` | Add the contract or clear the allowlist |
| `"rate limit exceeded"` | Wallet exceeded `maxTxPerHour` | Wait for the window to expire, or increase the limit |

**3. Check if the default policy is in effect:**

The default policy has `maxValueWei: "0"`, which denies ALL transactions. This is a safety default -- you must configure a policy with appropriate limits.

### Resolution

Review and update the policy configuration. See [Configuration Reference](../configuration.md) for all PolicyConfig fields.

---

## Symptom: Transactions Failing on Broadcast

**Severity:** Medium
**Description:** ISCL signs the transaction but broadcast fails (`broadcastError` is non-null).

### Diagnosis

**1. Check broadcast errors in the audit trail:**

```sql
SELECT data FROM audit_events
WHERE event = 'broadcast'
  AND json_extract(data, '$.success') = 0
ORDER BY timestamp DESC
LIMIT 5;
```

**2. Common broadcast errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `"nonce too low"` | Another transaction with the same nonce was confirmed | Retry -- the next attempt will use the correct nonce |
| `"insufficient funds for gas"` | Wallet doesn't have enough ETH for gas | Fund the wallet with native ETH |
| `"replacement transaction underpriced"` | A pending transaction exists with higher gas | Wait for the pending transaction to confirm, or increase gas |
| `"execution reverted"` | The transaction would revert on-chain | Check preflight simulation -- this should have been caught |

**3. Check RPC health:**

```bash
curl -s -X POST YOUR_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

If this fails, the RPC endpoint is down or unreachable.

### Resolution

- For nonce errors: usually self-correcting on retry
- For gas errors: send ETH to the wallet
- For RPC errors: check provider status, switch to backup RPC
- For persistent reverts: check the transaction parameters (insufficient token balance, expired deadline)

---

## Symptom: RPC Errors (502 Responses)

**Severity:** Medium
**Description:** API returns HTTP 502 with `"no_rpc_client"` or RPC timeout errors.

### Diagnosis

**1. Verify RPC configuration:**

```bash
# Check which RPC URLs are configured
env | grep ISCL_RPC_URL
env | grep BASE_RPC_URL
```

**2. Test RPC connectivity:**

```bash
curl -s -X POST $ISCL_RPC_URL_8453 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**3. Check for provider rate limiting:**

If you see intermittent 502s, your RPC provider may be rate limiting. Look for HTTP 429 responses in ISCL Core logs.

### Resolution

| Cause | Fix |
|-------|-----|
| No RPC URL configured | Set `ISCL_RPC_URL_{chainId}` environment variable |
| Wrong chain ID | Verify the `chainId` in the TxIntent matches a configured RPC |
| RPC provider down | Switch to an alternative provider |
| Rate limited | Upgrade your RPC plan or reduce transaction frequency |

---

## Symptom: Approval Requests Timing Out

**Severity:** Low
**Description:** Users report "Transaction expired" when trying to approve transactions.

### Diagnosis

**1. Check the approval TTL:**

The default TTL is 300 seconds (5 minutes). If operators consistently need more time, the TTL may be too short.

**2. Check for stale pending requests:**

```bash
curl -s http://localhost:3100/v1/approvals/pending | jq
```

If this shows requests with low `ttlSeconds`, they are about to expire.

**3. Check approval mode:**

```bash
echo $ISCL_APPROVAL_MODE
```

If set to `cli` but no one is watching the terminal, approvals will time out.

### Resolution

| Cause | Fix |
|-------|-----|
| No one watching the terminal | Switch to `web` mode and use the browser dashboard |
| TTL too short | This is not configurable in v0.1; the 300s default is fixed |
| Web dashboard not open | Open `http://localhost:3100/approval-ui` |
| Telegram bot not connected | Ensure the bot is running and can reach ISCL Core |

---

## Symptom: Signing Fails ("No key found")

**Severity:** Medium
**Description:** The approval succeeds but signing fails with a key-not-found error.

### Diagnosis

**1. List available keys:**

```bash
npx clavion-cli key list --keystore-path ~/.iscl/keystore
```

**2. Compare with the wallet address in the intent:**

The `wallet.address` in the TxIntent must match an address in the keystore (case-insensitive).

**3. Check keystore path:**

Ensure the ISCL Core process can access the keystore directory. In Docker, the keystore is mounted as a volume.

### Resolution

| Cause | Fix |
|-------|-----|
| Key not imported | Run `clavion-cli key import` or `key generate` |
| Wrong keystore path | Set `--keystore-path` or check the Docker volume mount |
| Address mismatch | Verify the wallet address matches the imported key |
| Passphrase issue | Ensure the keystore passphrase is available to ISCL Core |

---

## Symptom: Sandbox Skill Times Out

**Severity:** Low
**Description:** A sandbox skill is killed (exit code 137) before completing.

### Diagnosis

**1. Check sandbox events:**

```sql
SELECT * FROM audit_events
WHERE event IN ('sandbox_started', 'sandbox_error', 'sandbox_completed')
ORDER BY timestamp DESC
LIMIT 10;
```

**2. Look for timeout indicators:**

```sql
SELECT data FROM audit_events
WHERE event = 'sandbox_error'
  AND json_extract(data, '$.error') = 'timeout'
ORDER BY timestamp DESC;
```

**3. Check manifest resource limits:**

The skill's `sandbox.timeoutMs` in the manifest controls the deadline. The default cap is 60 seconds.

### Resolution

| Cause | Fix |
|-------|-----|
| Timeout too low | Increase `timeoutMs` in the skill manifest (max: 60000) |
| Skill has infinite loop | Debug the skill code outside the sandbox first |
| Memory limit hit | Increase `memoryMb` in the manifest (max: 512) |
| Docker not available | Ensure Docker daemon is running |

---

## Symptom: High Memory Usage

**Severity:** Low
**Description:** ISCL Core process memory exceeds expected levels (>300MB).

### Diagnosis

**1. Check Node.js heap usage:**

```bash
# If you have access to the process
node -e "console.log(process.memoryUsage())"
```

**2. Check for leaked pending approvals:**

```bash
curl -s http://localhost:3100/v1/approvals/pending | jq length
```

A large number of stale pending approvals suggests the cleanup interval isn't running or requests are being submitted faster than they expire.

**3. Check SQLite database size:**

```bash
ls -lh ~/.iscl/audit.sqlite*
```

### Resolution

| Cause | Fix |
|-------|-----|
| Many stale approvals | They auto-cleanup every 30s; wait or restart Core |
| Large SQLite DB | Run `VACUUM` during maintenance window |
| Node.js heap growth | Restart the process; check for memory leaks in custom integrations |

---

## Symptom: Preflight Simulation Fails

**Severity:** Low
**Description:** The preflight service reports simulation failure, blocking the transaction.

### Diagnosis

**1. Check the preflight result in audit trail:**

```sql
SELECT data FROM audit_events
WHERE event = 'preflight_simulated'
ORDER BY timestamp DESC
LIMIT 5;
```

Look for `simulationSuccess: false` and the associated error message.

**2. Common simulation failures:**

| Simulation Error | Cause |
|-----------------|-------|
| `"execution reverted"` | Insufficient token balance, expired deadline, or bad parameters |
| `"gas estimation failed"` | Transaction would revert -- check balances and allowances |
| `"RPC error"` | RPC endpoint issue -- see "RPC Errors" section above |

### Resolution

- Verify the sender has sufficient balance for the transfer/swap
- Check that ERC-20 approvals are in place for swap router interactions
- Ensure the deadline hasn't passed
- Verify the target contract exists on the specified chain

---

## General Investigation Procedure

For any incident not covered above:

1. **Get the intent ID** from error messages, API responses, or logs
2. **Pull the full audit trail:**
   ```sql
   SELECT event, timestamp, data FROM audit_events
   WHERE intent_id = '<intent-id>'
   ORDER BY timestamp ASC;
   ```
3. **Identify where the pipeline failed** -- Which event is the last one? What does its `data` show?
4. **Check surrounding events** for context:
   ```sql
   SELECT event, intent_id, data FROM audit_events
   WHERE timestamp BETWEEN <failure_ts - 60000> AND <failure_ts + 60000>
   ORDER BY timestamp ASC;
   ```
5. **Correlate with application logs** (pino structured logs) for stack traces and detailed error context

---

## References

- [Audit Trail Guide](audit-trail.md) -- Event types, SQL query patterns
- [Error Catalog](../api/errors.md) -- HTTP error shapes and recovery
- [Configuration Reference](../configuration.md) -- All configurable parameters
- [Observability Guide](observability.md) -- Logging and monitoring setup
- [Performance Tuning](performance-tuning.md) -- Resource optimization
