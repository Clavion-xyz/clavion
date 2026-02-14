import type { TxIntent, BuildPlan } from "@clavion/types";
import type { OneInchClient } from "../../aggregator/oneinch-client.js";
import { buildTransfer } from "./transfer-builder.js";
import { buildApprove } from "./approve-builder.js";
import { buildSwap } from "./swap-builder.js";
import { buildSwapOneInch } from "./swap-oneinch-builder.js";
import { buildTransferNative } from "./transfer-native-builder.js";

export interface BuilderDeps {
  oneInchClient?: OneInchClient;
}

export async function buildFromIntent(
  intent: TxIntent,
  deps?: BuilderDeps,
): Promise<BuildPlan> {
  switch (intent.action.type) {
    case "transfer":
      return buildTransfer(intent);
    case "transfer_native":
      return buildTransferNative(intent);
    case "approve":
      return buildApprove(intent);
    case "swap_exact_in":
    case "swap_exact_out":
      return buildSwapWithFallback(intent, deps);
    default:
      throw new Error(
        `Unsupported action type: ${(intent.action as { type: string }).type}`,
      );
  }
}

async function buildSwapWithFallback(
  intent: TxIntent,
  deps?: BuilderDeps,
): Promise<BuildPlan> {
  const action = intent.action;
  if (action.type !== "swap_exact_in" && action.type !== "swap_exact_out") {
    throw new Error(`Expected swap action, got ${action.type}`);
  }

  const provider = action.provider ?? "uniswap_v3";

  // Try 1inch for swap_exact_in with an available client
  if (
    provider === "1inch" &&
    action.type === "swap_exact_in" &&
    deps?.oneInchClient
  ) {
    try {
      return await buildSwapOneInch(intent, deps.oneInchClient);
    } catch (err) {
      console.warn("[1inch-fallback] Falling back to Uniswap V3:", err instanceof Error ? err.message : String(err));
      return buildSwap(intent);
    }
  }

  return buildSwap(intent);
}

export { buildTransfer } from "./transfer-builder.js";
export { buildTransferNative } from "./transfer-native-builder.js";
export { buildApprove } from "./approve-builder.js";
export { buildSwap } from "./swap-builder.js";
export { buildSwapOneInch } from "./swap-oneinch-builder.js";
export { computeTxRequestHash } from "./build-utils.js";
