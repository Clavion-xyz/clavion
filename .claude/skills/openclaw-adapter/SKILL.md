---
name: openclaw-adapter
description: >
  ISCL OpenClaw Adapter — thin skill wrappers that connect OpenClaw to ISCL Core. Use when
  building adapter skills, writing OpenClaw-compatible wrappers, handling installation
  tooling, or running compatibility tests. Triggers: OpenClaw integration, adapter skills,
  thin wrapper, OpenClaw compatibility, skill wrappers, ClawBridge, installer scripts.
---

# OpenClaw Adapter

The adapter is a set of **thin skill wrappers** in Domain A that translate OpenClaw skill
invocations into ISCL API calls over localhost. They contain zero crypto logic and zero
key material.

## Architecture

```
OpenClaw Runtime
  └── Adapter Skill (e.g., "clavion-swap")
        └── HTTP POST → http://localhost:{ISCL_PORT}/v1/tx/build
        └── HTTP POST → http://localhost:{ISCL_PORT}/v1/tx/preflight
        └── HTTP POST → http://localhost:{ISCL_PORT}/v1/tx/approve-request
        └── HTTP POST → http://localhost:{ISCL_PORT}/v1/tx/sign-and-send
```

## Wrapper Skill Pattern

Each adapter skill is a minimal OpenClaw skill that:

1. Receives user intent (natural language → structured parameters)
2. Constructs a TxIntent v1 object
3. Calls ISCL API endpoints in sequence
4. Returns results to OpenClaw for display

```typescript
// adapter/skills/clavion-swap/index.ts
import { ISCLClient } from "../shared/iscl-client.js";

export async function handleSwap(params: SwapParams): Promise<SkillResult> {
  const client = new ISCLClient(process.env.ISCL_API_URL);

  // 1. Build TxIntent
  const intent: TxIntent = {
    version: "1",
    id: randomUUID(),
    timestamp: Math.floor(Date.now() / 1000),
    chain: { type: "evm", chainId: 8453, rpcHint: "base" },
    wallet: { address: params.walletAddress, profile: "default" },
    action: {
      type: "swap_exact_in",
      router: KNOWN_ROUTERS.uniswapV3Base,
      assetIn: params.tokenIn,
      assetOut: params.tokenOut,
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
    },
    constraints: {
      maxGasWei: "1000000000000000",
      deadline: Math.floor(Date.now() / 1000) + 600,
      maxSlippageBps: params.slippageBps ?? 100,
    },
    metadata: { source: "clavion-swap" },
  };

  // 2. Build
  const buildPlan = await client.txBuild(intent);

  // 3. Preflight
  const preflight = await client.txPreflight(intent);

  // 4. Request approval (ISCL shows UI, waits for user)
  const approval = await client.txApproveRequest(intent);

  // 5. Sign and send
  const result = await client.txSignAndSend(intent, approval.token);

  return { txHash: result.txHash, status: "sent" };
}
```

## ISCLClient — Shared HTTP Client

```typescript
// adapter/shared/iscl-client.ts
class ISCLClient {
  constructor(private baseUrl: string) {}

  async txBuild(intent: TxIntent) {
    return this.post("/v1/tx/build", intent);
  }
  async txPreflight(intent: TxIntent) {
    return this.post("/v1/tx/preflight", intent);
  }
  async txApproveRequest(intent: TxIntent) {
    return this.post("/v1/tx/approve-request", intent);
  }
  async txSignAndSend(intent: TxIntent, approvalToken: string) {
    return this.post("/v1/tx/sign-and-send", { intent, approvalToken });
  }

  private async post(path: string, body: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ISCLError(res.status, await res.json());
    return res.json();
  }
}
```

## Adapter Skills to Build (v0.1)

| Skill | Action | Description |
|---|---|---|
| `clavion-swap` | swap_exact_in | Swap tokens via DEX |
| `clavion-transfer` | transfer | Send ERC20 tokens |
| `clavion-approve` | approve | Set token allowance |
| `clavion-balance` | (read-only) | Check wallet balances (no signing) |

## Installation Tooling

The installer:
1. Copies adapter skills into OpenClaw's skill directory
2. Verifies ISCL Core is running (`GET /v1/health`)
3. Configures `ISCL_API_URL` for the skills
4. Runs compatibility check against pinned OpenClaw version

## Compatibility Testing

```yaml
# CI matrix
openclaw_versions:
  - pinned: "v0.5.2"    # known-good version
  - latest: "stable"     # detect breaking changes early

tests:
  - adapter skills load correctly
  - TxIntent construction succeeds
  - API calls reach ISCL Core
  - Error handling works for all error codes
```

## Key Rules

- Adapters are **thin** — no crypto logic, no key handling, no policy decisions
- Adapters **never** cache or store sensitive data
- All security is enforced by ISCL Core, not the adapter
- Adapter errors surface ISCL error codes to the user (don't swallow them)
- Pin OpenClaw dependency version, test against latest in CI
