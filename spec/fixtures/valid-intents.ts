import type { TxIntent } from "../../core/types.js";

export const validTransferIntent: TxIntent = {
  version: "1",
  id: "550e8400-e29b-41d4-a716-446655440000",
  timestamp: 1700000000,
  chain: { type: "evm", chainId: 8453 },
  wallet: { address: "0x1234567890abcdef1234567890abcdef12345678" },
  action: {
    type: "transfer",
    asset: {
      kind: "erc20",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
    },
    to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    amount: "1000000",
  },
  constraints: {
    maxGasWei: "1000000000000000",
    deadline: 1700003600,
    maxSlippageBps: 100,
  },
};

export const validApproveIntent: TxIntent = {
  version: "1",
  id: "550e8400-e29b-41d4-a716-446655440001",
  timestamp: 1700000000,
  chain: { type: "evm", chainId: 8453 },
  wallet: { address: "0x1234567890abcdef1234567890abcdef12345678" },
  action: {
    type: "approve",
    asset: {
      kind: "erc20",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
    },
    spender: "0x2626664c2603336E57B271c5C0b26F421741e481",
    amount: "1000000000",
  },
  constraints: {
    maxGasWei: "500000000000000",
    deadline: 1700003600,
    maxSlippageBps: 0,
  },
};

export const validSwapExactInIntent: TxIntent = {
  version: "1",
  id: "550e8400-e29b-41d4-a716-446655440002",
  timestamp: 1700000000,
  chain: { type: "evm", chainId: 8453, rpcHint: "base" },
  wallet: { address: "0x1234567890abcdef1234567890abcdef12345678", profile: "default" },
  action: {
    type: "swap_exact_in",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    assetIn: {
      kind: "erc20",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
    },
    assetOut: {
      kind: "erc20",
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      decimals: 18,
    },
    amountIn: "1000000",
    minAmountOut: "400000000000000",
  },
  constraints: {
    maxGasWei: "2000000000000000",
    deadline: 1700003600,
    maxSlippageBps: 100,
  },
  preferences: {
    speed: "normal",
    privateRelay: false,
  },
  metadata: {
    source: "test-skill",
    note: "test swap",
  },
};

export const validTransferNativeIntent: TxIntent = {
  version: "1",
  id: "550e8400-e29b-41d4-a716-446655440004",
  timestamp: 1700000000,
  chain: { type: "evm", chainId: 8453 },
  wallet: { address: "0x1234567890abcdef1234567890abcdef12345678" },
  action: {
    type: "transfer_native",
    to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    amount: "100000000000000000",
  },
  constraints: {
    maxGasWei: "1000000000000000",
    deadline: 1700003600,
    maxSlippageBps: 0,
  },
};

export const validSwapExactOutIntent: TxIntent = {
  version: "1",
  id: "550e8400-e29b-41d4-a716-446655440003",
  timestamp: 1700000000,
  chain: { type: "evm", chainId: 8453 },
  wallet: { address: "0x1234567890abcdef1234567890abcdef12345678" },
  action: {
    type: "swap_exact_out",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    assetIn: {
      kind: "erc20",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
    },
    assetOut: {
      kind: "erc20",
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      decimals: 18,
    },
    amountOut: "500000000000000",
    maxAmountIn: "1500000",
  },
  constraints: {
    maxGasWei: "2000000000000000",
    deadline: 1700003600,
    maxSlippageBps: 150,
  },
};
