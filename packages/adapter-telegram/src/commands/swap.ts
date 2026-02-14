import type { Context } from "grammy";
import type { SwapExactInAction } from "@clavion/types";
import type { ISCLClient } from "../shared/iscl-client.js";
import type { TelegramAdapterConfig } from "../config.js";
import type { ActiveTransactionStore } from "../approval/approval-flow.js";
import { buildIntent } from "../shared/intent-builder.js";
import { initiateApprovalFlow } from "../approval/approval-flow.js";

// Default Uniswap V3 SwapRouter02 addresses per chain
const UNISWAP_V3_ROUTERS: Record<number, string> = {
  1: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  10: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  8453: "0x2626664c2603336E57B271c5C0b26F421741e481",
  42161: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
};

const SWAP_RE =
  /^\/swap\s+(\d+)\s+(0x[a-fA-F0-9]{40})\s+for\s+(0x[a-fA-F0-9]{40})(?:\s+min\s+(\d+))?(?:\s+router\s+(0x[a-fA-F0-9]{40}))?(?:\s+provider\s+(uniswap_v3|1inch))?$/i;

export function parseSwapCommand(
  text: string,
): {
  amountIn: string;
  tokenIn: string;
  tokenOut: string;
  minAmountOut: string;
  router?: string;
  provider?: "uniswap_v3" | "1inch";
} | null {
  const match = SWAP_RE.exec(text);
  if (!match) return null;
  return {
    amountIn: match[1]!,
    tokenIn: match[2]!,
    tokenOut: match[3]!,
    minAmountOut: match[4] ?? "0",
    router: match[5],
    provider: match[6] as "uniswap_v3" | "1inch" | undefined,
  };
}

export async function handleSwapCommand(
  ctx: Context,
  client: ISCLClient,
  config: TelegramAdapterConfig,
  store: ActiveTransactionStore,
): Promise<void> {
  const text = ctx.message?.text ?? "";
  const params = parseSwapCommand(text);

  if (!params) {
    await ctx.reply(
      "Usage: /swap <amountIn> <tokenInAddr> for <tokenOutAddr> [min <minOut>] [router <routerAddr>] [provider <uniswap_v3|1inch>]\n" +
        "Example: /swap 1000000 0xUSDC for 0xWETH",
    );
    return;
  }

  const router =
    params.router ?? UNISWAP_V3_ROUTERS[config.chainId] ?? UNISWAP_V3_ROUTERS[8453]!;

  const action: SwapExactInAction = {
    type: "swap_exact_in",
    router,
    provider: params.provider,
    assetIn: { kind: "erc20", address: params.tokenIn },
    assetOut: { kind: "erc20", address: params.tokenOut },
    amountIn: params.amountIn,
    minAmountOut: params.minAmountOut,
  };

  const intent = buildIntent({
    walletAddress: config.walletAddress,
    action,
    chainId: config.chainId,
  });

  await initiateApprovalFlow(ctx, intent, client, config, store);
}
