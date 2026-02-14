# Multi-Chain Operations

How to configure and operate ISCL across multiple EVM chains.

## Supported Chains

| Chain | Chain ID | Env Variable | Status |
|-------|----------|-------------|--------|
| Ethereum | 1 | `ISCL_RPC_URL_1` | Supported |
| Optimism | 10 | `ISCL_RPC_URL_10` | Supported |
| Arbitrum | 42161 | `ISCL_RPC_URL_42161` | Supported |
| Base | 8453 | `ISCL_RPC_URL_8453` | Supported (default) |

Additional EVM chains can be added by configuring an RPC URL and updating the policy config.

## RPC Configuration

### Single-Chain Setup

For a single chain, set one RPC URL:

```bash
ISCL_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

Or use the legacy variable (equivalent to chain 8453):

```bash
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

A single URL creates a plain `ViemRpcClient`. All operations target this one chain.

### Multi-Chain Setup

For multiple chains, set multiple RPC URLs:

```bash
ISCL_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/KEY
ISCL_RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/KEY
ISCL_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/KEY
ISCL_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/KEY
```

Multiple URLs create an `RpcRouter` that dispatches calls per chain ID.

### Resolution Logic

The RPC resolution process (from `parseRpcEnv()` in `packages/core/src/rpc/parse-rpc-env.ts`):

1. Scan all environment variables matching `ISCL_RPC_URL_{\d+}`
2. If `BASE_RPC_URL` is set and `ISCL_RPC_URL_8453` is not, map `BASE_RPC_URL` to chain 8453
3. One URL found → plain `ViemRpcClient`
4. Multiple URLs → `RpcRouter` (dispatches per chain)
5. No URLs → preflight and broadcast disabled (build-only mode)

**Precedence:** `ISCL_RPC_URL_8453` always takes priority over `BASE_RPC_URL`.

## How Chain Selection Works

Every operation is scoped to a chain via the `TxIntent.chain.chainId` field:

```json
{
  "chain": { "type": "evm", "chainId": 8453 }
}
```

This chain ID drives all downstream routing:

- **Transaction builders** select chain-specific contract addresses (e.g., Uniswap V3 router per chain)
- **Preflight simulation** uses the chain-scoped RPC for `eth_call` and `estimateGas`
- **Signing** uses the chain-scoped RPC for nonce, gas fees, and broadcast
- **Balance lookups** accept an optional `?chainId=N` query parameter:
  ```bash
  curl http://localhost:3100/v1/balance/0xToken/0xAccount?chainId=10
  ```

If no RPC is configured for the requested chain, the endpoint returns `502 no_rpc_client`.

## DEX Router Addresses

### Uniswap V3 Routers

| Chain | Chain ID | Router Address |
|-------|----------|---------------|
| Ethereum | 1 | `0x68b3465833fb72B5A828cCEEEAA56DFb8BA3DaFE` |
| Optimism | 10 | `0x68b3465833fb72B5A828cCEEEAA56DFb8BA3DaFE` |
| Arbitrum | 42161 | `0x68b3465833fb72B5A828cCEEEAA56DFb8BA3DaFE` |
| Base | 8453 | `0x2626664c2603336E57B271c5C0b26F421741e481` |

Note: Base uses a different router address than the other chains.

### 1inch AggregationRouterV6

Same address on all supported chains:
```
0x111111125421cA6dc452d289314280a0f8842A65
```

Requires `ONEINCH_API_KEY` environment variable. When not set, 1inch intents silently fall back to Uniswap V3.

## Policy Configuration for Multi-Chain

### allowedChains

The `allowedChains` field in PolicyConfig controls which chains are permitted:

```json
{
  "allowedChains": [1, 10, 42161, 8453]
}
```

A TxIntent targeting a chain not in this list is denied with: `"Chain N not in allowed chains [...]"`.

### Token and Contract Allowlists

Allowlists are **not chain-scoped** in PolicyConfig v1. The same token address may exist on multiple chains (e.g., USDC has different addresses per chain). Include all relevant addresses:

```json
{
  "tokenAllowlist": [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
  ]
}
```

## Adding a New Chain

To add support for an additional EVM chain:

1. **Configure RPC:** Set `ISCL_RPC_URL_{chainId}` with a valid RPC endpoint
2. **Update policy:** Add the chain ID to `allowedChains` in your PolicyConfig
3. **Router addresses (for swaps):** If Uniswap V3 is deployed on the chain, add its router address to `UNISWAP_V3_ROUTERS` in `packages/core/src/tx/builders/swap-builder.ts`. The 1inch router address is the same on all chains
4. **Token addresses:** Add chain-specific token addresses to your allowlists

No code changes are required for basic transfers and approvals -- only RPC configuration and policy updates.

## Troubleshooting

### "PreflightService requires an RPC client for chain N"

**Cause:** No `ISCL_RPC_URL_{N}` environment variable set for the requested chain.
**Fix:** Add `ISCL_RPC_URL_{N}=https://your-rpc-provider/...` to your environment.

### "Chain N not in allowed chains"

**Cause:** PolicyConfig `allowedChains` doesn't include the requested chain ID.
**Fix:** Update your policy config to include the chain ID in `allowedChains`.

### "Balance lookup requires an RPC client for chain N"

**Cause:** Same as preflight -- no RPC configured for that chain.
**Fix:** Add the appropriate `ISCL_RPC_URL_{N}` variable.

### Transactions work on chain A but not chain B

Verify:
1. `ISCL_RPC_URL_{B}` is set and the URL is valid
2. Chain B is in `allowedChains`
3. For swaps: the router address is configured for chain B
4. Token addresses in allowlists exist on chain B (addresses differ per chain)

## See Also

- [Configuration Guide](../configuration.md) -- full environment variable reference and PolicyConfig options
- [Deployment Guide](deployment.md) -- production deployment with Docker and compose
