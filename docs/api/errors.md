# ISCL API Error Catalog

Complete reference for all error responses returned by the ISCL Core API (`http://127.0.0.1:3100`).

---

## Error Response Shapes

The API uses three distinct error response shapes depending on the error source.

### 1. Fastify Validation Error

Returned when the request body, path parameters, or query parameters fail JSON Schema validation. Fastify generates these automatically from the registered route schemas.

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body/action/type must be equal to one of the allowed values"
}
```

### 2. Policy Error

Returned when the PolicyEngine evaluates a TxIntent and issues a `deny` decision. Contains structured denial reasons and the policy version that produced the decision.

```json
{
  "error": "policy_denied",
  "decision": "deny",
  "reasons": ["Chain 999 not in allowed chains [8453]"],
  "policyVersion": "1"
}
```

### 3. Simple Error

Used for all other error conditions (missing resources, RPC failures, signing errors, approval issues). Contains a machine-readable error code and a human-readable message.

```json
{
  "error": "error_code",
  "message": "Human-readable description of the problem."
}
```

---

## Status Codes

| Code | Meaning | Returned By |
|------|---------|-------------|
| 200 | Success | All endpoints on success |
| 400 | Bad Request -- schema validation or static analysis failure | `POST /v1/tx/*` (malformed TxIntent), `POST /v1/skills/register` (invalid manifest) |
| 403 | Forbidden -- policy denied, user declined, signing failed, or invalid token | `POST /v1/tx/build`, `/v1/tx/approve-request`, `/v1/tx/sign-and-send` |
| 404 | Not Found -- resource does not exist | `GET /v1/tx/:hash`, `GET /v1/skills/:name`, `DELETE /v1/skills/:name`, `POST /v1/approvals/:requestId/decide` |
| 409 | Conflict -- duplicate resource | `POST /v1/skills/register` (duplicate skill name) |
| 502 | Bad Gateway -- RPC client not configured or RPC call failed | `POST /v1/tx/preflight`, `GET /v1/tx/:hash`, `GET /v1/balance/:token/:account` |

---

## Per-Endpoint Error Reference

### POST /v1/tx/build

Build a transaction from a TxIntent. Evaluates policy before building.

**400 -- Fastify Validation Error**

TxIntent body does not match the schema. See [schemas.md](schemas.md) for the full TxIntent specification.

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body/action must be object"
}
```

**403 -- `policy_denied`**

The PolicyEngine denied the intent. The `reasons` array contains one or more human-readable denial explanations.

```json
{
  "error": "policy_denied",
  "decision": "deny",
  "reasons": ["Chain 999 not in allowed chains [8453]"],
  "policyVersion": "1"
}
```

Possible denial reasons include:

- `"Chain X not in allowed chains [...]"`
- `"Token X not in allowlist"`
- `"Contract X not in allowlist"`
- `"Value X exceeds max Y"`
- `"Approval amount X exceeds max Y"`
- `"Recipient X not in allowlist"`
- `"Rate limit exceeded: N transactions in the past hour (limit: M)"`

---

### POST /v1/tx/preflight

Simulate a transaction and compute a risk score. Requires an RPC endpoint for the target chain.

**400 -- Fastify Validation Error**

TxIntent body does not match the schema.

**502 -- `no_rpc_client`**

No RPC endpoint is configured for the intent's target chain.

```json
{
  "error": "no_rpc_client",
  "message": "PreflightService requires an RPC client for chain 8453, which is not configured."
}
```

---

### POST /v1/tx/approve-request

Prompt the user for approval and return an approval token. Runs preflight simulation and policy evaluation.

**400 -- Fastify Validation Error**

TxIntent body does not match the schema.

**403 -- `policy_denied`**

Policy engine denied the intent after preflight evaluation (includes risk score assessment). Same response shape as `/v1/tx/build` denial.

```json
{
  "error": "policy_denied",
  "decision": "deny",
  "reasons": ["Value 5000000000000000000 exceeds max 1000000000000000000"],
  "policyVersion": "1"
}
```

**403 -- `user_declined`**

The operator rejected the transaction in the approval prompt (CLI or web UI). This is expected behavior when the human reviewer decides the transaction should not proceed.

```json
{
  "intentId": "550e8400-e29b-41d4-a716-446655440000",
  "txRequestHash": "0x1234...abcd",
  "policyDecision": {
    "decision": "require_approval",
    "reasons": ["Value 1000000 exceeds approval threshold 0"],
    "policyVersion": "1"
  },
  "approvalRequired": true,
  "approved": false,
  "reason": "user_declined"
}
```

---

### POST /v1/tx/sign-and-send

Sign a transaction and broadcast it. Requires an unlocked key in the keystore. If policy requires approval, an `approvalTokenId` must be provided.

**400 -- Fastify Validation Error**

Body does not match the expected schema `{ intent: TxIntent, approvalTokenId?: uuid }`.

**403 -- `policy_denied`**

Policy re-check during signing failed. The policy is evaluated again at sign time to prevent time-of-check/time-of-use attacks.

```json
{
  "error": "policy_denied",
  "reasons": ["Rate limit exceeded: 11 transactions in the past hour (limit: 10)"]
}
```

**403 -- `approval_required`**

The transaction requires an approval token but none was provided. Call `/v1/tx/approve-request` first.

```json
{
  "error": "approval_required",
  "message": "This transaction requires an approval token.",
  "txRequestHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

**403 -- `invalid_approval_token`**

The provided token was not found, has expired (300s TTL), or was already consumed (tokens are single-use).

```json
{
  "error": "invalid_approval_token",
  "message": "Approval token not found or expired."
}
```

**403 -- `signing_failed`**

The keystore could not produce a signature. This typically means the key for the wallet address is not unlocked or not present in the keystore.

```json
{
  "error": "signing_failed",
  "message": "Key for address 0x1234567890abcdef1234567890abcdef12345678 is not unlocked"
}
```

---

### GET /v1/tx/:hash

Look up a transaction receipt by hash. Requires an RPC endpoint.

**400 -- Fastify Validation Error**

The `hash` path parameter does not match the required pattern `^0x[0-9a-fA-F]{64}$`.

**404 -- `not_found`**

The receipt is not yet available (transaction may still be pending) or the hash is invalid.

```json
{
  "error": "not_found",
  "message": "Transaction receipt not found. It may be pending or the hash is invalid."
}
```

**502 -- `no_rpc_client`**

No RPC endpoint is configured.

```json
{
  "error": "no_rpc_client",
  "message": "Transaction receipt lookup requires an RPC client, which is not configured."
}
```

---

### GET /v1/balance/:token/:account

Look up an ERC-20 token or native ETH balance.

**400 -- Fastify Validation Error**

The `token` or `account` path parameters do not match the required pattern `^0x[0-9a-fA-F]{40}$`, or the `chainId` query parameter is not a numeric string.

**502 -- `no_rpc_client`**

No RPC endpoint is configured, optionally chain-specific when using `?chainId=N`.

```json
{
  "error": "no_rpc_client",
  "message": "Balance lookup requires an RPC client for chain 42161, which is not configured."
}
```

**502 -- `rpc_error`**

The RPC call succeeded in reaching the provider but the provider returned an error.

```json
{
  "error": "rpc_error",
  "message": "connection refused"
}
```

---

### POST /v1/skills/register

Register a skill manifest. Validates schema, verifies ECDSA signature, checks file hashes, and runs static analysis.

**200 -- Success**

```json
{
  "registered": true,
  "name": "my-skill",
  "manifestHash": "0xabcdef..."
}
```

**400 -- `schema_validation_failed`**

The manifest does not match the SkillManifest schema. See [schemas.md](schemas.md) for the full specification.

```json
{
  "registered": false,
  "name": "my-skill",
  "manifestHash": "",
  "error": "schema_validation_failed",
  "validationErrors": ["manifest/permissions must be array"]
}
```

**400 -- `signature_verification_failed`**

The ECDSA signature on the manifest does not match the declared publisher address.

```json
{
  "registered": false,
  "name": "my-skill",
  "manifestHash": "",
  "error": "signature_verification_failed"
}
```

**400 -- `file_hash_mismatch`**

One or more SHA-256 file hashes in the manifest do not match the actual file contents. The response includes the specific mismatches.

```json
{
  "registered": false,
  "name": "my-skill",
  "manifestHash": "",
  "error": "file_hash_mismatch",
  "hashMismatches": [
    { "file": "run.mjs", "expected": "0xabc...", "actual": "0xdef..." }
  ]
}
```

**400 -- `static_scan_failed`**

Security violations were found during static analysis of the skill code.

```json
{
  "registered": false,
  "name": "my-skill",
  "manifestHash": "",
  "error": "static_scan_failed",
  "scanFindings": [
    "Prohibited import: 'child_process'",
    "Direct network access detected: fetch()"
  ]
}
```

**409 -- `duplicate_skill`**

A skill with this name is already registered and active.

```json
{
  "registered": false,
  "name": "my-skill",
  "manifestHash": "",
  "error": "duplicate_skill"
}
```

---

### GET /v1/skills/:name

Get a registered skill by name.

**404 -- `skill_not_found`**

The skill is not registered or has been revoked.

```json
{
  "error": "skill_not_found",
  "name": "my-skill"
}
```

---

### DELETE /v1/skills/:name

Revoke a registered skill. Audit-logged as `skill_revoked`.

**404 -- `skill_not_found`**

The skill is not registered.

```json
{
  "error": "skill_not_found",
  "name": "my-skill"
}
```

---

### POST /v1/approvals/:requestId/decide

Submit an approve or deny decision for a pending approval request.

**400 -- Fastify Validation Error**

Body does not match the expected schema `{ approved: boolean }`.

**404 -- `not_found`**

The approval request has expired (300s TTL) or does not exist.

```json
{
  "error": "not_found",
  "message": "Approval request not found or expired."
}
```

---

### GET /v1/approvals/pending

List all pending approval requests. No error responses -- always returns `{ pending: [] }` even when empty.

---

### GET /v1/approvals/history

Recent audit events for the approval dashboard. No error responses -- always returns `{ events: [] }` even when empty. The `limit` query parameter is clamped to 1-100.

---

### GET /approval-ui

Serves the web approval dashboard as HTML. No error responses -- always returns the HTML page.

---

### GET /v1/health

Health check endpoint. No error responses -- always returns `{ status: "ok", version: "0.1.0", uptime: number }`.

---

## Error Recovery Guide

Actionable guidance for each error condition.

### 400 -- Validation Errors

Check your TxIntent against the schema at [schemas.md](schemas.md). Common issues:

- Missing required fields (`version`, `id`, `timestamp`, `chain`, `wallet`, `action`, `constraints`)
- Wrong address format -- must be `0x` followed by exactly 40 hex characters
- Amounts must be numeric strings (e.g., `"1000000"`, not `1000000`)
- `action.type` must be one of: `transfer`, `transfer_native`, `approve`, `swap_exact_in`, `swap_exact_out`
- `chain.chainId` must be a supported chain: 1 (Ethereum), 10 (Optimism), 42161 (Arbitrum), 8453 (Base)

### 403 -- `policy_denied`

Review your PolicyConfig. Check the following:

- Is the chain in `allowedChains`?
- Is the token in `tokenAllowlist` (if the allowlist is non-empty)?
- Is the contract in `contractAllowlist` (if the allowlist is non-empty)?
- Is the value under `maxValueWei`?
- Is the recipient in `recipientAllowlist` (if the allowlist is non-empty)?
- Has the wallet exceeded `maxTxPerHour`?

### 403 -- `approval_required`

The transaction needs a valid approval token. Call `POST /v1/tx/approve-request` first to get an `approvalTokenId`, then pass it in the request body to `/v1/tx/sign-and-send`:

```json
{
  "intent": { ... },
  "approvalTokenId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 403 -- `invalid_approval_token`

The token was already consumed (tokens are single-use), expired (300-second TTL), or does not match the intent's `txRequestHash`. Get a fresh token by calling `POST /v1/tx/approve-request` again.

### 403 -- `signing_failed`

The wallet's private key is not unlocked in the keystore. Ensure a key has been imported or generated:

```bash
clavion-cli key import             # Import private key from stdin
clavion-cli key generate           # Generate a new random key
clavion-cli key list               # Verify the key is present
```

In Docker, check that the `ISCL_DEMO_PASSPHRASE` environment variable is set correctly.

### 403 -- `user_declined`

The operator denied the transaction in the approval UI (CLI prompt or web dashboard). This is expected behavior -- the system is working as designed. The agent should inform the user that the transaction was rejected by the human operator.

### 404 -- `not_found`

For transaction receipts: the transaction may still be pending. Wait a few seconds and retry the lookup. For skills: verify the skill name is correct and that the skill has not been revoked via `DELETE /v1/skills/:name`.

### 409 -- `duplicate_skill`

A skill with this name is already registered and active. Either revoke the existing skill first, then re-register:

```bash
curl -X DELETE http://localhost:3100/v1/skills/my-skill
curl -X POST http://localhost:3100/v1/skills/register -H "Content-Type: application/json" -d '...'
```

Or choose a different skill name.

### 502 -- `no_rpc_client`

No RPC endpoint is configured for the target chain. Set the appropriate environment variable. See [../configuration.md](../configuration.md) for the full configuration reference.

```bash
# Per-chain RPC endpoints
export ISCL_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
export ISCL_RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
export ISCL_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
export ISCL_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Legacy fallback for Base
export BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 502 -- `rpc_error`

The RPC provider returned an error. Troubleshooting steps:

1. Verify your RPC URL is correct and the provider is online
2. Check that you have sufficient API credits or rate limit headroom
3. Try the RPC URL directly with `curl` to confirm connectivity
4. If using a free tier, consider upgrading or switching providers

---

## Client-Side Error Handling

All adapters (OpenClaw, MCP, Eliza, Telegram) use the `ISCLClient` class which wraps HTTP errors in a typed `ISCLError`:

```typescript
class ISCLError extends Error {
  readonly status: number;   // HTTP status code
  readonly body: unknown;    // Parsed JSON response body
}
```

Recommended error handling pattern:

```typescript
try {
  const result = await client.txApproveRequest(intent);
} catch (err) {
  if (err instanceof ISCLError) {
    if (err.status === 403) {
      const body = err.body as { error: string; reasons?: string[] };
      if (body.error === "policy_denied") {
        // Handle policy denial -- show reasons to user
        console.log("Policy denied:", body.reasons);
      } else if (body.error === "approval_required") {
        // Need to get approval token first
      } else if (body.error === "invalid_approval_token") {
        // Token expired or already used -- get a new one
      }
    } else if (err.status === 502) {
      // RPC not configured -- cannot simulate or broadcast
      console.log("RPC unavailable:", (err.body as { message: string }).message);
    }
  }
  throw err; // Re-throw unexpected errors
}
```

---

## See Also

- [API Overview](overview.md) -- endpoint reference with success response examples
- [Schema Specification](schemas.md) -- TxIntent and SkillManifest schemas
- [Configuration Reference](../configuration.md) -- environment variables and PolicyConfig
