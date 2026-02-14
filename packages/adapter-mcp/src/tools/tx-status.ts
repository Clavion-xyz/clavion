import type { ISCLClient } from "../shared/iscl-client.js";
import type { McpToolResult } from "../formatters.js";
import { formatError } from "../formatters.js";

interface TxStatusArgs {
  txHash: string;
}

export async function handleTxStatus(
  args: TxStatusArgs,
  client: ISCLClient,
): Promise<McpToolResult> {
  try {
    const receipt = await client.txReceipt(args.txHash);
    return {
      content: [
        {
          type: "text",
          text: [
            "Transaction Receipt",
            `Hash: ${receipt.transactionHash}`,
            `Status: ${receipt.status}`,
            `Block: ${receipt.blockNumber}`,
            `From: ${receipt.from}`,
            `To: ${receipt.to ?? "contract creation"}`,
            `Gas used: ${receipt.gasUsed}`,
            `Effective gas price: ${receipt.effectiveGasPrice}`,
            ...(receipt.contractAddress
              ? [`Contract address: ${receipt.contractAddress}`]
              : []),
          ].join("\n"),
        },
      ],
    };
  } catch (err) {
    return formatError(err);
  }
}
