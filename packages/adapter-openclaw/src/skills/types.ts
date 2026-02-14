export interface AssetParam {
  kind: "erc20";
  address: string;
  symbol?: string;
  decimals?: number;
}

export interface BaseSkillParams {
  walletAddress: string;
  chainId?: number;
  rpcHint?: string;
  maxGasWei?: string;
  deadline?: number;
  source?: string;
}

export interface TransferParams extends BaseSkillParams {
  asset: AssetParam;
  to: string;
  amount: string;
}

export interface TransferNativeParams extends BaseSkillParams {
  to: string;
  amount: string;
}

export interface ApproveParams extends BaseSkillParams {
  asset: AssetParam;
  spender: string;
  amount: string;
}

export interface SwapParams extends BaseSkillParams {
  router: string;
  assetIn: AssetParam;
  assetOut: AssetParam;
  amountIn: string;
  minAmountOut: string;
  slippageBps?: number;
  provider?: "uniswap_v3" | "1inch";
}

export interface BalanceParams {
  walletAddress: string;
  tokenAddress: string;
  chainId?: number;
}

export interface SkillResult {
  success: boolean;
  intentId?: string;
  txHash?: string;
  description?: string;
  error?: string;
  data?: Record<string, unknown>;
}
