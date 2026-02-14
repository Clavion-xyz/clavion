# ADR-003: TxIntent Declarative Format

**Status:** Accepted
**Date:** 2025-02-01
**Deciders:** Architecture team

## Context

AI agents need to perform crypto operations: token transfers, DEX swaps, spending approvals, and native ETH transfers. The question is: what format should agents use to express these requests to the signing layer?

The core tension is between **expressiveness** and **safety**. A more expressive format lets agents do more things, but a more constrained format is easier to validate, simulate, and explain to users.

### Approach 1: Raw Transaction Signing

The agent constructs a complete EVM transaction (to, data, value, gas parameters) and sends it to the signing layer for signature.

Problems:
- **No policy enforcement.** Raw calldata is opaque -- the policy engine cannot determine whether a transaction is a benign transfer or a malicious contract call without decoding every possible contract ABI.
- **No simulation safety.** The signing layer cannot meaningfully simulate or explain what a raw transaction does without understanding the target contract.
- **Attack surface.** A compromised agent can craft arbitrary calldata: call selfdestruct, interact with attacker-controlled contracts, set unlimited approvals, or perform reentrancy attacks. The signing layer has no semantic understanding to prevent this.
- **No user-readable approval.** The approval prompt would show raw hex calldata. Users cannot meaningfully approve or deny what they cannot understand.

### Approach 2: High-Level SDK Calls

The agent imports a crypto SDK and calls typed functions like `sdk.transfer(token, to, amount)`. The SDK handles transaction construction and signing internally.

Problems:
- **Library sharing violates trust boundaries.** If the agent imports the signing SDK, it has access to the signing functions in its process memory. A compromised agent could call signing functions directly, bypassing policy and approval.
- **No audit trail.** Operations happen as function calls within the agent process. There is no natural interception point for logging, policy enforcement, or user confirmation.
- **Framework coupling.** Each agent framework (OpenClaw, ElizaOS, MCP, Telegram) has different language and runtime requirements. A single SDK would need to support all of them.

### Approach 3: Declarative Intent Format

The agent constructs a JSON document describing what it wants to do (action type, parameters, constraints) and submits it to a separate process for execution. The executing process handles transaction construction, policy evaluation, simulation, approval, and signing.

This is the approach we evaluated.

## Decision

Define a **TxIntent v1** JSON schema as the universal request format for all crypto operations. Agents construct TxIntents; ISCL Core interprets and executes them.

### Design Principles

**Agents express "what", never "how".** A TxIntent says "transfer 100 USDC to 0xAlice" -- it does not specify the ERC-20 `transfer(address,uint256)` function selector, ABI encoding, gas price, nonce, or chain-specific parameters. ISCL Core handles all of that.

**Closed set of action types.** TxIntent v1 defines exactly five action types: `transfer`, `transfer_native`, `approve`, `swap_exact_in`, and `swap_exact_out`. There is no generic "call" or "execute" action. This means every possible operation is known at compile time, can be validated against a strict schema, and can be explained in human-readable terms.

**Strict schema validation.** The schema uses `additionalProperties: false` at every level. No undocumented fields pass validation. This prevents agents from injecting unexpected data that might be interpreted by downstream components.

**Canonical form for integrity.** TxIntents are canonicalized using JCS (JSON Canonicalization Scheme) and hashed with keccak256. This produces a deterministic fingerprint used for approval token binding -- the token is tied to a specific intent, preventing substitution attacks.

### Schema Structure

```
TxIntent v1
├── version: "1"                    -- Schema version for forward compatibility
├── id: UUID                        -- Idempotency key and audit correlation
├── timestamp: number               -- Unix milliseconds, creation time
├── chain
│   ├── type: "evm"                 -- Chain family (only EVM in v1)
│   ├── chainId: number             -- Target chain (1, 10, 42161, 8453)
│   └── rpcHint?: string            -- Optional RPC URL hint (informational only)
├── wallet
│   ├── address: "0x..."            -- Signing wallet
│   └── profile?: string            -- Optional wallet profile name
├── action: (one of)
│   ├── transfer                    -- ERC-20 transfer
│   ├── transfer_native             -- Native ETH transfer
│   ├── approve                     -- ERC-20 spending approval
│   ├── swap_exact_in               -- DEX swap with exact input
│   └── swap_exact_out              -- DEX swap with exact output
├── constraints
│   ├── maxGasWei: string           -- Hard cap on gas cost
│   ├── deadline: number            -- Unix timestamp expiry
│   └── maxSlippageBps: number      -- Slippage tolerance (basis points)
├── preferences?
│   ├── gasSpeed?: string           -- slow | normal | fast
│   └── privateRelay?: boolean      -- Use private mempool
└── metadata?
    ├── source?: string             -- Adapter name (for audit)
    └── note?: string               -- Human-readable context
```

### Action Type Definitions

Each action type has a fixed set of fields. No action accepts arbitrary contract addresses or calldata as direct parameters.

| Action | Fields | What ISCL Builds |
|--------|--------|------------------|
| `transfer` | `asset`, `to`, `amount` | ERC-20 `transfer(address,uint256)` call |
| `transfer_native` | `to`, `amount` | Plain ETH value transfer (no calldata) |
| `approve` | `asset`, `spender`, `amount` | ERC-20 `approve(address,uint256)` call |
| `swap_exact_in` | `router`, `assetIn`, `assetOut`, `amountIn`, `minAmountOut`, `provider?` | Uniswap V3 `exactInputSingle` or 1inch API calldata |
| `swap_exact_out` | `router`, `assetIn`, `assetOut`, `amountOut`, `maxAmountIn`, `provider?` | Uniswap V3 `exactOutputSingle` |

The `router` field on swap actions is validated against a known set of router addresses per chain. An agent cannot specify an arbitrary contract -- only known, audited DEX routers are accepted.

### What TxIntent Prevents

By restricting operations to a closed set of action types, the format makes entire categories of attacks impossible at the schema level:

- **Arbitrary contract calls.** There is no "call(address, calldata)" action type. An agent cannot interact with contracts that are not ERC-20 tokens or known DEX routers.
- **Self-destruct or delegate calls.** No action type maps to these operations.
- **Unlimited approvals by default.** The `approve` action requires an explicit `amount`. The policy engine can enforce a cap via `maxApprovalAmount`.
- **Calldata injection.** ISCL Core constructs calldata from typed parameters. The agent never provides raw hex calldata.
- **Gas manipulation.** Gas parameters are set by ISCL Core based on RPC estimation, not by the agent. The `maxGasWei` constraint provides a ceiling but not a floor.

### Extensibility

Adding a new action type requires a Domain B code change (new builder, schema entry, policy rule). This is intentional -- every new operation must be explicitly implemented, reviewed, and tested before agents can use it. The schema version field (`"1"`) allows future incompatible changes via a new version number.

## Consequences

### Positive

- **Every operation is human-readable.** The approval prompt can always show a clear description: "Transfer 100 USDC to 0xAlice on Base" rather than raw hex. Users can make informed approval decisions.
- **Policy engine has full semantic understanding.** The policy engine knows exactly what each intent does: which tokens are involved, what value is being transferred, which contracts are targeted. This enables precise rules (token allowlists, value caps, recipient restrictions).
- **Preflight simulation is meaningful.** Because ISCL Core builds the transaction from typed parameters, it knows exactly what to simulate and what balance changes to expect. Anomalous simulation results (unexpected balance changes, revert) are detectable.
- **Framework-agnostic.** Any adapter that can produce JSON can construct a TxIntent. The format is the same whether the request comes from OpenClaw, MCP, ElizaOS, Telegram, or a future adapter.
- **Canonical hashing enables integrity binding.** Approval tokens are bound to specific intent hashes. Modifying any field after approval invalidates the token. This prevents substitution attacks (approve a small transfer, then swap the intent for a large one).

### Negative

- **Limited expressiveness.** Agents cannot perform operations outside the five defined action types. Complex DeFi strategies (flash loans, multi-step arbitrage, yield farming) require new action types to be implemented in Domain B. This limits what agents can do autonomously.
- **New action types require core changes.** Adding a new operation (e.g., NFT minting, bridge transfers) requires changes to the schema, a new builder, policy engine updates, preflight updates, fixture generation, and adapter updates. The process is thorough but slow.
- **Swap router addresses must be maintained.** The known router address list must be updated when new chains are added or DEX versions are deployed. An outdated list blocks agents from using newer contracts.

### Neutral

- **All amounts are strings.** Wei values can exceed JavaScript's `Number.MAX_SAFE_INTEGER` (2^53 - 1). Using strings for all amounts avoids precision loss at the schema level. ISCL Core converts to `bigint` internally for arithmetic.
- **The deadline is business logic, not schema validation.** The schema validates that `deadline` is a number. Checking whether the deadline has passed is done by the transaction builder at execution time, not by the JSON Schema validator.
- **The `provider` field on swap actions adds optional routing.** Setting `provider: "1inch"` routes through the 1inch aggregator for better pricing. The default `"uniswap_v3"` uses direct Uniswap V3 router calls. This is backward-compatible -- existing intents without the field use Uniswap V3.

## References

- [Schema Specification](../../api/schemas.md) -- Full JSON Schema definitions for TxIntent v1
- [API Reference](../../api/overview.md) -- Endpoints that accept TxIntents
- [Error Catalog](../../api/errors.md) -- Schema validation error shapes
- [ADR-001: Trust Domain Isolation](001-trust-domain-isolation.md) -- How intents cross the Domain A → B boundary
