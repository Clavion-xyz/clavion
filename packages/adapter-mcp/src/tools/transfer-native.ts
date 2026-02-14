import type { ISCLClient } from "../shared/iscl-client.js";
import type { McpToolResult } from "../formatters.js";
import type { TransferNativeAction } from "@clavion/types";
import { buildIntent } from "./intent-builder.js";
import { executeSecurePipeline } from "./pipeline.js";
import { formatPipelineResult, formatError } from "../formatters.js";

interface TransferNativeArgs {
  wallet: string;
  to: string;
  amount: string;
  chainId?: number;
  maxGasWei?: string;
}

export async function handleTransferNative(
  args: TransferNativeArgs,
  client: ISCLClient,
): Promise<McpToolResult> {
  try {
    const action: TransferNativeAction = {
      type: "transfer_native",
      to: args.to,
      amount: args.amount,
    };

    const intent = buildIntent({
      walletAddress: args.wallet,
      action,
      chainId: args.chainId,
      maxGasWei: args.maxGasWei,
    });

    const result = await executeSecurePipeline(intent, client);
    return formatPipelineResult(result, "Native ETH Transfer");
  } catch (err) {
    return formatError(err);
  }
}
