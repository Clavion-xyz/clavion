# @clavion/plugin-eliza

ElizaOS (ai16z) plugin for secure crypto operations. Replaces `@elizaos/plugin-evm`
with policy-enforced signing via Clavion -- no private keys in the agent runtime.

## Actions

| Action | Description |
|--------|-------------|
| `CLAVION_TRANSFER` | Transfer ERC-20 tokens |
| `CLAVION_TRANSFER_NATIVE` | Transfer native ETH |
| `CLAVION_APPROVE` | Set ERC-20 spending allowance |
| `CLAVION_SWAP` | Swap tokens via Uniswap V3 |
| `CLAVION_BALANCE` | Check ERC-20 token balance |

## Prerequisites

ISCL Core must be running. The plugin connects on startup but does not fail if
Core is temporarily unavailable.

## Install

```bash
npm install @clavion/plugin-eliza
```

Peer dependency: `@elizaos/core ^1.7.0`.

## Usage

```typescript
import { clavionPlugin } from "@clavion/plugin-eliza";

const character = {
  // ...
  plugins: [clavionPlugin],
  settings: {
    ISCL_API_URL: "http://localhost:3100",
  },
};
```

Set `ISCL_API_URL` in the character settings instead of `EVM_PRIVATE_KEY`. The
plugin extracts transaction parameters from natural language using LLM templates,
then routes everything through the ISCL secure pipeline.

## How It Works

1. User sends a message like "send 100 USDC to 0xabc..."
2. ElizaOS matches the `CLAVION_TRANSFER` action
3. Plugin extracts parameters via `runtime.generateText()`
4. Builds a TxIntent and sends it through Core's approve-request and sign-and-send endpoints
5. All signing, policy checks, and audit logging happen in Core (Domain B)

## Project Root

[Back to main README](../../README.md)
