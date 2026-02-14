import type { ISCLClient } from "../shared/iscl-client.js";
import type { McpToolResult } from "../formatters.js";
import type { TransferAction } from "@clavion/types";
import { buildIntent } from "./intent-builder.js";
import { executeSecurePipeline } from "./pipeline.js";
import { formatPipelineResult, formatError } from "../formatters.js";

interface TransferArgs {
  wallet: string;
  asset: { kind: "erc20"; address: string; symbol?: string; decimals?: number };
  to: string;
  amount: string;
  chainId?: number;
  maxGasWei?: string;
}

export async function handleTransfer(
  args: TransferArgs,
  client: ISCLClient,
): Promise<McpToolResult> {
  try {
    const action: TransferAction = {
      type: "transfer",
      asset: args.asset,
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
    return formatPipelineResult(result, "ERC-20 Transfer");
  } catch (err) {
    return formatError(err);
  }
}
