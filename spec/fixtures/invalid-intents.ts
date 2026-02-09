// Each fixture represents a specific validation failure case.
// All are plain objects (not typed as TxIntent) since they're intentionally invalid.

const baseFields = {
  version: "1" as const,
  id: "550e8400-e29b-41d4-a716-446655440099",
  timestamp: 1700000000,
  chain: { type: "evm" as const, chainId: 8453 },
  wallet: { address: "0x1234567890abcdef1234567890abcdef12345678" },
  constraints: { maxGasWei: "1000000000000000", deadline: 1700003600, maxSlippageBps: 100 },
};

const validAction = {
  type: "transfer" as const,
  asset: { kind: "erc20" as const, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  amount: "1000000",
};

/** Missing required field: no action */
export const missingAction = {
  version: "1",
  id: "550e8400-e29b-41d4-a716-446655440099",
  timestamp: 1700000000,
  chain: { type: "evm", chainId: 8453 },
  wallet: { address: "0x1234567890abcdef1234567890abcdef12345678" },
  constraints: { maxGasWei: "1000000000000000", deadline: 1700003600, maxSlippageBps: 100 },
};

/** Unknown field at root level */
export const unknownField = {
  ...baseFields,
  action: validAction,
  unknownProperty: "should-not-be-here",
};

/** Invalid version */
export const wrongVersion = {
  ...baseFields,
  version: "2",
  action: validAction,
};

/** Bad address format */
export const badAddress = {
  ...baseFields,
  wallet: { address: "not-an-address" },
  action: validAction,
};

/** Non-numeric amount */
export const nonNumericAmount = {
  ...baseFields,
  action: {
    type: "transfer",
    asset: { kind: "erc20", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    amount: "abc",
  },
};

/** Negative deadline (schema requires minimum: 0) */
export const negativeDeadline = {
  ...baseFields,
  constraints: { maxGasWei: "1000000000000000", deadline: -1, maxSlippageBps: 100 },
  action: validAction,
};

/** Unknown action type */
export const unknownActionType = {
  ...baseFields,
  action: {
    type: "bridge",
    asset: { kind: "erc20", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    amount: "1000000",
  },
};

/** Extra field on action object */
export const extraActionField = {
  ...baseFields,
  action: {
    ...validAction,
    extraField: "should-not-be-here",
  },
};

/** transfer_native with asset field (additionalProperties: false rejects it) */
export const nativeTransferWithAsset = {
  ...baseFields,
  action: {
    type: "transfer_native",
    to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    amount: "100000000000000000",
    asset: { kind: "erc20", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  },
};
