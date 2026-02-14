# Eliza (ElizaOS) Adapter Plan

## Context

ElizaOS (v1.7.2, formerly ai16z) is the de facto standard for AI agent development in Web3 — 90+ community plugins, actively maintained, TypeScript monorepo. Existing crypto plugins like `@elizaos/plugin-evm` store private keys in character config and sign directly in action handlers. Clavion replaces this pattern with policy-enforced, audited signing through ISCL Core.

## Architecture

```
ElizaOS Agent Runtime
    ↓ plugin actions
@clavion/plugin-eliza (Domain A — untrusted)
    ↓ HTTP (ISCLClient)
@clavion/core (Domain B — trusted)
    ↓ policy → approval → signing → broadcast
Blockchain
```

The plugin is a **replacement** for `@elizaos/plugin-evm`'s wallet/signing layer. The agent never sees private keys — only `ISCL_API_URL` and `ISCL_WALLET_ADDRESS` in its character config.

## Plugin Components

| Component | Type | Purpose |
|-----------|------|---------|
| `ClavionService` | Service | Initializes ISCLClient, verifies Core is reachable on startup |
| `walletProvider` | Provider | Injects wallet address + balances into agent context before each action |
| `TRANSFER` | Action | ERC-20 transfer via secure pipeline |
| `TRANSFER_NATIVE` | Action | Native ETH transfer via secure pipeline |
| `APPROVE` | Action | ERC-20 spending approval via secure pipeline |
| `SWAP` | Action | Uniswap V3 swap via secure pipeline |
| `CHECK_BALANCE` | Action | Read-only balance lookup (no signing) |

## Character Configuration

```json
{
  "name": "SecureCryptoAgent",
  "modelProvider": "anthropic",
  "settings": {
    "secrets": {
      "ISCL_API_URL": "http://localhost:3000",
      "ISCL_WALLET_ADDRESS": "0x..."
    }
  },
  "plugins": ["@clavion/plugin-eliza"]
}
```

No `EVM_PRIVATE_KEY` — keys live in Clavion Core only.

## Package Structure

```
packages/plugin-eliza/
├── package.json              # peerDep: @elizaos/core; dep: @clavion/types
├── tsconfig.json
└── src/
    ├── index.ts              # Plugin export: { name, actions, providers, services }
    ├── service.ts            # ClavionService: ISCLClient lifecycle + health check
    ├── provider.ts           # walletProvider: injects balance/address into agent context
    ├── shared/
    │   ├── iscl-client.ts    # HTTP client to ISCL Core (copied from adapter pattern)
    │   ├── intent-builder.ts # TxIntent construction (source="eliza-adapter")
    │   └── pipeline.ts       # executeSecurePipeline (approve-request → sign-and-send)
    ├── actions/
    │   ├── transfer.ts       # TRANSFER action
    │   ├── transfer-native.ts
    │   ├── approve.ts
    │   ├── swap.ts
    │   └── balance.ts
    └── templates.ts          # LLM prompt templates for parameter extraction
```

## Action Interface Pattern

Each action follows ElizaOS's interface:

```typescript
const transferAction: Action = {
  name: "CLAVION_TRANSFER",
  similes: ["SEND_TOKENS", "TRANSFER_TOKENS", "SEND_ERC20"],
  description: "Transfer ERC-20 tokens securely via Clavion",
  examples: [
    [
      { user: "user", content: { text: "Send 100 USDC to 0xAlice" } },
      { user: "assistant", content: { text: "Transferring 100 USDC...", action: "CLAVION_TRANSFER" } },
    ],
  ],
  validate: async (runtime, message, state) => {
    // Check ISCL_API_URL is configured
    const apiUrl = await runtime.getSetting("ISCL_API_URL");
    return !!apiUrl;
  },
  handler: async (runtime, message, state, options, callback) => {
    // 1. Extract parameters from message using LLM template
    // 2. Build TxIntent via intent-builder
    // 3. Execute secure pipeline (approve-request → sign-and-send)
    // 4. Return result via callback
  },
};
```

## Provider Pattern

```typescript
const walletProvider: Provider = {
  name: "clavionWallet",
  description: "Provides Clavion wallet address and balance context",
  position: -1, // High priority — inject before action decisions
  get: async (runtime, message, state) => {
    const address = await runtime.getSetting("ISCL_WALLET_ADDRESS");
    const apiUrl = await runtime.getSetting("ISCL_API_URL");
    // Fetch balances from ISCL Core
    // Return formatted context string for agent's LLM prompt
    return `Clavion Wallet: ${address}\nUSDC Balance: ${balance}`;
  },
};
```

## Service Pattern

```typescript
class ClavionService implements Service {
  private client: ISCLClient | null = null;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    const apiUrl = await runtime.getSetting("ISCL_API_URL");
    this.client = new ISCLClient({ baseUrl: apiUrl });
    const health = await this.client.health();
    // Verify Core is reachable, log version
  }

  getClient(): ISCLClient {
    if (!this.client) throw new Error("ClavionService not initialized");
    return this.client;
  }
}
```

## LLM Template for Parameter Extraction

Actions use a prompt template to extract structured parameters from natural language:

```typescript
const transferTemplate = `Extract transfer parameters from the message:
- token address or symbol
- recipient address
- amount (in human-readable units)
- chain (default: Base)

Message: {{message}}

Respond with JSON: { "token": "...", "to": "...", "amount": "...", "chain": "base" }`;
```

The handler calls `runtime.composeContext()` with this template, then parses the LLM's response to get typed parameters.

## Testing Strategy: Full ElizaOS Runtime

### Unit Tests (mock ISCLClient)
- Each action's `validate()` function
- Each action's `handler()` with mocked runtime + ISCLClient
- Provider `get()` returns correct context string
- Service initialization + health check
- Intent builder (same as MCP adapter tests)
- Pipeline (same as MCP adapter tests)

### Integration Tests (real ElizaOS runtime)
- `@elizaos/core` as devDependency
- Create a test agent runtime with our plugin registered
- Verify plugin registration succeeds (actions, providers, services all register)
- Call action handlers through the runtime with test messages
- Pair with a real Fastify app (buildApp) on an ephemeral port
- Verify the full flow: message → parameter extraction → ISCLClient → Core → response

### E2E Test (optional, requires Anvil)
- Character file + Clavion Core + Anvil fork
- Send natural language message through agent
- Verify on-chain state changes

## Key Design Decisions

1. **`@elizaos/core` as peerDependency** — user provides their ElizaOS runtime, we don't bundle it
2. **ISCLClient copied, not shared** — same pattern as MCP adapter, keeps adapters independent
3. **Source = "eliza-adapter"** — distinguishes Eliza operations in audit trail
4. **No competing with plugin-evm** — document that our plugin replaces EVM wallet management
5. **Timeout: 60s for approval actions** — human approval can take time

## Dependencies

```json
{
  "peerDependencies": {
    "@elizaos/core": "^1.7.0"
  },
  "dependencies": {
    "@clavion/types": "0.1.0"
  },
  "devDependencies": {
    "@elizaos/core": "^1.7.0"
  }
}
```

## Implementation Sequence

1. Create package scaffolding
2. Install `@elizaos/core` (devDep) + update root tsconfig
3. Copy ISCLClient + intent-builder + pipeline from adapter-mcp
4. Implement ClavionService (ISCLClient lifecycle)
5. Implement walletProvider (balance/address context injection)
6. Implement LLM templates for parameter extraction
7. Implement 5 actions (transfer, transfer-native, approve, swap, balance)
8. Implement plugin index.ts (export all components)
9. Write unit tests (mocked runtime + ISCLClient)
10. Write integration tests (real ElizaOS runtime + real Fastify app)
11. Build, run full test suite
12. Update CLAUDE.md
