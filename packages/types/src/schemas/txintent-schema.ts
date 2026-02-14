/**
 * TxIntent v1 JSON Schema — canonical AJV-compatible schema.
 * Source: ISCL API Schema Specification v0.1 + txintent-json-schema reference.
 */
export const TxIntentSchema = {
  type: "object",
  required: ["version", "id", "timestamp", "chain", "wallet", "action", "constraints"],
  additionalProperties: false,
  properties: {
    version: { const: "1" },
    id: { type: "string", format: "uuid" },
    timestamp: { type: "integer", minimum: 0 },
    chain: {
      type: "object",
      required: ["type", "chainId"],
      additionalProperties: false,
      properties: {
        type: { enum: ["evm"] },
        chainId: { type: "integer", minimum: 1 },
        rpcHint: { type: "string" },
      },
    },
    wallet: {
      type: "object",
      required: ["address"],
      additionalProperties: false,
      properties: {
        address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        profile: { type: "string" },
      },
    },
    action: {
      oneOf: [
        { $ref: "#/$defs/transferAction" },
        { $ref: "#/$defs/approveAction" },
        { $ref: "#/$defs/swapExactInAction" },
        { $ref: "#/$defs/swapExactOutAction" },
        { $ref: "#/$defs/transferNativeAction" },
      ],
    },
    constraints: {
      type: "object",
      required: ["maxGasWei", "deadline", "maxSlippageBps"],
      additionalProperties: false,
      properties: {
        maxGasWei: { type: "string", pattern: "^[0-9]+$" },
        deadline: { type: "integer", minimum: 0 },
        maxSlippageBps: { type: "integer", minimum: 0, maximum: 10000 },
      },
    },
    preferences: {
      type: "object",
      additionalProperties: false,
      properties: {
        speed: { enum: ["slow", "normal", "fast"] },
        privateRelay: { type: "boolean" },
      },
    },
    metadata: {
      type: "object",
      additionalProperties: false,
      properties: {
        source: { type: "string" },
        note: { type: "string" },
      },
    },
  },
  $defs: {
    asset: {
      type: "object",
      required: ["kind", "address"],
      additionalProperties: false,
      properties: {
        kind: { enum: ["erc20"] },
        address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        symbol: { type: "string" },
        decimals: { type: "integer", minimum: 0, maximum: 18 },
      },
    },
    transferAction: {
      type: "object",
      required: ["type", "asset", "to", "amount"],
      additionalProperties: false,
      properties: {
        type: { const: "transfer" },
        asset: { $ref: "#/$defs/asset" },
        to: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        amount: { type: "string", pattern: "^[0-9]+$" },
      },
    },
    approveAction: {
      type: "object",
      required: ["type", "asset", "spender", "amount"],
      additionalProperties: false,
      properties: {
        type: { const: "approve" },
        asset: { $ref: "#/$defs/asset" },
        spender: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        amount: { type: "string", pattern: "^[0-9]+$" },
      },
    },
    swapExactInAction: {
      type: "object",
      required: ["type", "router", "assetIn", "assetOut", "amountIn", "minAmountOut"],
      additionalProperties: false,
      properties: {
        type: { const: "swap_exact_in" },
        router: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        provider: { enum: ["uniswap_v3", "1inch"] },
        assetIn: { $ref: "#/$defs/asset" },
        assetOut: { $ref: "#/$defs/asset" },
        amountIn: { type: "string", pattern: "^[0-9]+$" },
        minAmountOut: { type: "string", pattern: "^[0-9]+$" },
      },
    },
    swapExactOutAction: {
      type: "object",
      required: ["type", "router", "assetIn", "assetOut", "amountOut", "maxAmountIn"],
      additionalProperties: false,
      properties: {
        type: { const: "swap_exact_out" },
        router: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        provider: { enum: ["uniswap_v3", "1inch"] },
        assetIn: { $ref: "#/$defs/asset" },
        assetOut: { $ref: "#/$defs/asset" },
        amountOut: { type: "string", pattern: "^[0-9]+$" },
        maxAmountIn: { type: "string", pattern: "^[0-9]+$" },
      },
    },
    transferNativeAction: {
      type: "object",
      required: ["type", "to", "amount"],
      additionalProperties: false,
      properties: {
        type: { const: "transfer_native" },
        to: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        amount: { type: "string", pattern: "^[0-9]+$" },
      },
    },
  },
} as const;
