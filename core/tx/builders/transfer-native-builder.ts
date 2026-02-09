import type { TxIntent, TransferNativeAction, BuildPlan } from "../../types.js";
import { computeTxRequestHash } from "./build-utils.js";

export function buildTransferNative(intent: TxIntent): BuildPlan {
  const action = intent.action as TransferNativeAction;
  if (action.type !== "transfer_native") {
    throw new Error(`Expected transfer_native action, got ${action.type}`);
  }

  const txRequest = {
    to: action.to as `0x${string}`,
    data: "0x" as `0x${string}`,
    value: BigInt(action.amount),
    chainId: intent.chain.chainId,
    type: "eip1559" as const,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
  };

  return {
    intentId: intent.id,
    txRequest,
    txRequestHash: computeTxRequestHash(txRequest),
    description: `Transfer ${action.amount} wei native ETH to ${action.to}`,
  };
}
