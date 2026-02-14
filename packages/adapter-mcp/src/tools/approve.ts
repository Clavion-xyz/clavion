import type { ISCLClient } from "../shared/iscl-client.js";
import type { McpToolResult } from "../formatters.js";
import type { ApproveAction } from "@clavion/types";
import { buildIntent } from "./intent-builder.js";
import { executeSecurePipeline } from "./pipeline.js";
import { formatPipelineResult, formatError } from "../formatters.js";

interface ApproveArgs {
  wallet: string;
  asset: { kind: "erc20"; address: string; symbol?: string; decimals?: number };
  spender: string;
  amount: string;
  chainId?: number;
  maxGasWei?: string;
}

export async function handleApprove(
  args: ApproveArgs,
  client: ISCLClient,
): Promise<McpToolResult> {
  try {
    const action: ApproveAction = {
      type: "approve",
      asset: args.asset,
      spender: args.spender,
      amount: args.amount,
    };

    const intent = buildIntent({
      walletAddress: args.wallet,
      action,
      chainId: args.chainId,
      maxGasWei: args.maxGasWei,
    });

    const result = await executeSecurePipeline(intent, client);
    return formatPipelineResult(result, "ERC-20 Approval");
  } catch (err) {
    return formatError(err);
  }
}
