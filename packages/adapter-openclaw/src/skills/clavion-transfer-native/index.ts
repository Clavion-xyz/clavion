import type { TransferNativeAction } from "@clavion/types";
import type { ISCLClient } from "../../shared/iscl-client.js";
import { ISCLError } from "../../shared/iscl-client.js";
import { buildIntent } from "../intent-builder.js";
import type { TransferNativeParams, SkillResult } from "../types.js";

export async function handleTransferNative(
  params: TransferNativeParams,
  client: ISCLClient,
): Promise<SkillResult> {
  try {
    const action: TransferNativeAction = {
      type: "transfer_native",
      to: params.to,
      amount: params.amount,
    };

    const intent = buildIntent({
      walletAddress: params.walletAddress,
      action,
      chainId: params.chainId,
      rpcHint: params.rpcHint,
      maxGasWei: params.maxGasWei,
      deadline: params.deadline,
      source: params.source,
    });

    const result = await client.txBuild(intent);

    return {
      success: true,
      intentId: result.intentId,
      description: result.description,
      data: { txRequestHash: result.txRequestHash },
    };
  } catch (err) {
    if (err instanceof ISCLError) {
      return { success: false, error: err.message };
    }
    throw err;
  }
}
