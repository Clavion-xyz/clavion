---
name: clavion-crypto
description: "Safely execute on-chain crypto operations (transfers, swaps, approvals, balance checks) via Clavion/ISCL secure layer. All transactions are policy-enforced, simulated, and require human approval before signing."
user-invocable: true
metadata: {"openclaw":{"requires":{"env":["ISCL_API_URL"]},"emoji":"🔐","primaryEnv":"ISCL_API_URL"}}
---

# Clavion Secure Crypto Operations

You have access to safe on-chain crypto tools via the Clavion/ISCL secure runtime. **You never sign transactions directly** — Clavion Core handles key isolation, policy enforcement, risk scoring, and human approval.

## Available Operations

### 1. Check Balance
Read-only. No signing, no approval needed.
```bash
node {baseDir}/run.mjs check_balance '{"tokenAddress":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","walletAddress":"0xYOUR_WALLET"}'
```

### 2. Safe Transfer (ERC-20)
Transfers tokens. Requires human approval.
```bash
node {baseDir}/run.mjs safe_transfer '{"walletAddress":"0xSENDER","asset":{"kind":"erc20","address":"0xTOKEN","symbol":"USDC","decimals":6},"to":"0xRECIPIENT","amount":"1000000"}'
```

### 3. Safe Transfer Native (ETH)
Transfers native ETH (not ERC-20). Requires human approval.
```bash
node {baseDir}/run.mjs safe_transfer_native '{"walletAddress":"0xSENDER","to":"0xRECIPIENT","amount":"100000000000000000"}'
```

### 4. Safe Approve (ERC-20 allowance)
Sets token allowance for a spender contract. Requires human approval.
```bash
node {baseDir}/run.mjs safe_approve '{"walletAddress":"0xOWNER","asset":{"kind":"erc20","address":"0xTOKEN","symbol":"USDC","decimals":6},"spender":"0xSPENDER_CONTRACT","amount":"1000000"}'
```

### 5. Safe Swap (Uniswap V3 exact-in)
Swaps tokens via Uniswap V3. Requires human approval.
```bash
node {baseDir}/run.mjs safe_swap_exact_in '{"walletAddress":"0xWALLET","router":"0x2626664c2603336E57B271c5C0b26F421741e481","assetIn":{"kind":"erc20","address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","symbol":"USDC","decimals":6},"assetOut":{"kind":"erc20","address":"0x4200000000000000000000000000000000000006","symbol":"WETH","decimals":18},"amountIn":"1000000","minAmountOut":"400000000000000"}'
```

## Important Rules

1. **Always check balance first** before attempting a transfer or swap.
2. **Amounts are in base units** (wei for ETH, 6 decimals for USDC, 18 for WETH). Convert user-friendly amounts to base units.
3. **The human operator must approve** every fund-affecting transaction. The Clavion Core daemon will prompt them — you just need to wait for the result.
4. **Policy may deny** transactions if they violate chain/token/value rules. If denied, explain the reason to the user.
5. **Default chain is Base (8453)**. Pass `"chainId":8453` explicitly or omit for default.
6. **Never attempt to sign, hold keys, or call blockchain RPC directly.** All on-chain actions go through Clavion Core.

## Common Token Addresses (Base)

| Token | Address | Decimals |
|-------|---------|----------|
| USDC  | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | 6 |
| WETH  | 0x4200000000000000000000000000000000000006 | 18 |
| DAI   | 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb | 18 |
| USDbC | 0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6Ca | 6 |

## Uniswap V3 SwapRouter02 (Base)
`0x2626664c2603336E57B271c5C0b26F421741e481`

## Output Format

All commands return JSON:
```json
{"success": true, "intentId": "...", "txHash": "0x...", "description": "..."}
```
On error:
```json
{"success": false, "error": "reason"}
```
