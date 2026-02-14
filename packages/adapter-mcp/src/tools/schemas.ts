import { z } from "zod";

const EthAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address (0x + 40 hex chars)");

const WeiAmount = z
  .string()
  .regex(/^\d+$/, "Must be a non-negative integer string (wei)");

const AssetSchema = z.object({
  kind: z.literal("erc20"),
  address: EthAddress.describe("ERC-20 contract address"),
  symbol: z.string().optional().describe("Token symbol (e.g. USDC, WETH)"),
  decimals: z.number().int().min(0).max(18).optional().describe("Token decimals (e.g. 6 for USDC, 18 for WETH)"),
});

const ChainId = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Chain ID (default: 8453 for Base)");

const MaxGasWei = z
  .string()
  .regex(/^\d+$/)
  .optional()
  .describe("Maximum gas in wei (default: 1000000000000000)");

export const TransferSchema = {
  wallet: EthAddress.describe("Sender wallet address"),
  asset: AssetSchema.describe("ERC-20 token to transfer"),
  to: EthAddress.describe("Recipient address"),
  amount: WeiAmount.describe("Transfer amount in token base units (e.g. 1000000 for 1 USDC)"),
  chainId: ChainId,
  maxGasWei: MaxGasWei,
};

export const TransferNativeSchema = {
  wallet: EthAddress.describe("Sender wallet address"),
  to: EthAddress.describe("Recipient address"),
  amount: WeiAmount.describe("Amount of ETH in wei (e.g. 1000000000000000000 for 1 ETH)"),
  chainId: ChainId,
  maxGasWei: MaxGasWei,
};

export const ApproveSchema = {
  wallet: EthAddress.describe("Token owner wallet address"),
  asset: AssetSchema.describe("ERC-20 token to approve"),
  spender: EthAddress.describe("Contract address to approve for spending"),
  amount: WeiAmount.describe("Approval amount in token base units"),
  chainId: ChainId,
  maxGasWei: MaxGasWei,
};

export const SwapSchema = {
  wallet: EthAddress.describe("Wallet address performing the swap"),
  router: EthAddress.describe("Uniswap V3 SwapRouter02 address"),
  assetIn: AssetSchema.describe("Input token (token you're selling)"),
  assetOut: AssetSchema.describe("Output token (token you're buying)"),
  amountIn: WeiAmount.describe("Exact input amount in base units"),
  minAmountOut: WeiAmount.describe("Minimum output amount (slippage floor) in base units"),
  slippageBps: z
    .number()
    .int()
    .min(0)
    .max(10000)
    .optional()
    .describe("Slippage tolerance in basis points (default: 100 = 1%)"),
  provider: z.enum(["uniswap_v3", "1inch"]).optional()
    .describe("Swap provider (default: uniswap_v3)"),
  chainId: ChainId,
  maxGasWei: MaxGasWei,
};

export const BalanceSchema = {
  wallet: EthAddress.describe("Wallet address to check balance of"),
  token: EthAddress.describe("ERC-20 token contract address"),
  chainId: ChainId,
};

export const TxStatusSchema = {
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid transaction hash (0x + 64 hex chars)")
    .describe("Transaction hash to look up"),
};
