import type { ISCLClient } from "../shared/iscl-client.js";
import type { McpToolResult } from "../formatters.js";
import { formatError } from "../formatters.js";

interface BalanceArgs {
  wallet: string;
  token: string;
  chainId?: number;
}

export async function handleBalance(
  args: BalanceArgs,
  client: ISCLClient,
): Promise<McpToolResult> {
  try {
    const result = await client.balance(args.token, args.wallet, args.chainId);
    return {
      content: [
        {
          type: "text",
          text: [
            "Token Balance",
            `Token: ${result.token}`,
            `Account: ${result.account}`,
            `Balance: ${result.balance} (base units)`,
          ].join("\n"),
        },
      ],
    };
  } catch (err) {
    return formatError(err);
  }
}
