import { encodeFunctionData } from "viem";
import type {
  TxIntent,
  SwapExactInAction,
  SwapExactOutAction,
  BuildPlan,
} from "@clavion/types";
import { computeTxRequestHash } from "./build-utils.js";

export const UNISWAP_V3_SWAP_ROUTER_BASE =
  "0x2626664c2603336E57B271c5C0b26F421741e481";
export const DEFAULT_FEE_TIER = 3000;

// SwapRouter02 ABI fragments (no deadline in struct)
const swapRouterAbi = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "exactOutputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
] as const;

export function buildSwap(intent: TxIntent): BuildPlan {
  const action = intent.action;
  if (action.type !== "swap_exact_in" && action.type !== "swap_exact_out") {
    throw new Error(`Expected swap action, got ${action.type}`);
  }

  if (
    action.router.toLowerCase() !==
    UNISWAP_V3_SWAP_ROUTER_BASE.toLowerCase()
  ) {
    throw new Error(
      `Unknown router: ${action.router}. Only Uniswap V3 SwapRouter02 on Base is supported.`,
    );
  }

  let data: `0x${string}`;
  let description: string;

  if (action.type === "swap_exact_in") {
    const a = action as SwapExactInAction;
    data = encodeFunctionData({
      abi: swapRouterAbi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: a.assetIn.address as `0x${string}`,
          tokenOut: a.assetOut.address as `0x${string}`,
          fee: DEFAULT_FEE_TIER,
          recipient: intent.wallet.address as `0x${string}`,
          amountIn: BigInt(a.amountIn),
          amountOutMinimum: BigInt(a.minAmountOut),
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    description = `Swap ${a.amountIn} ${a.assetIn.symbol ?? "tokenIn"} for ${a.assetOut.symbol ?? "tokenOut"} via Uniswap V3`;
  } else {
    const a = action as SwapExactOutAction;
    data = encodeFunctionData({
      abi: swapRouterAbi,
      functionName: "exactOutputSingle",
      args: [
        {
          tokenIn: a.assetIn.address as `0x${string}`,
          tokenOut: a.assetOut.address as `0x${string}`,
          fee: DEFAULT_FEE_TIER,
          recipient: intent.wallet.address as `0x${string}`,
          amountOut: BigInt(a.amountOut),
          amountInMaximum: BigInt(a.maxAmountIn),
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    description = `Swap for ${a.amountOut} ${a.assetOut.symbol ?? "tokenOut"} using ${a.assetIn.symbol ?? "tokenIn"} via Uniswap V3`;
  }

  const txRequest = {
    to: action.router as `0x${string}`,
    data,
    value: 0n,
    chainId: intent.chain.chainId,
    type: "eip1559" as const,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
  };

  return {
    intentId: intent.id,
    txRequest,
    txRequestHash: computeTxRequestHash(txRequest),
    description,
  };
}
