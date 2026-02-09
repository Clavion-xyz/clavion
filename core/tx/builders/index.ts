import type { TxIntent, BuildPlan } from "../../types.js";
import { buildTransfer } from "./transfer-builder.js";
import { buildApprove } from "./approve-builder.js";
import { buildSwap } from "./swap-builder.js";
import { buildTransferNative } from "./transfer-native-builder.js";

export function buildFromIntent(intent: TxIntent): BuildPlan {
  switch (intent.action.type) {
    case "transfer":
      return buildTransfer(intent);
    case "transfer_native":
      return buildTransferNative(intent);
    case "approve":
      return buildApprove(intent);
    case "swap_exact_in":
    case "swap_exact_out":
      return buildSwap(intent);
    default:
      throw new Error(
        `Unsupported action type: ${(intent.action as { type: string }).type}`,
      );
  }
}

export { buildTransfer } from "./transfer-builder.js";
export { buildTransferNative } from "./transfer-native-builder.js";
export { buildApprove } from "./approve-builder.js";
export { buildSwap } from "./swap-builder.js";
export { computeTxRequestHash } from "./build-utils.js";
