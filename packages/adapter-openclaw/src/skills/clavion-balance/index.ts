import type { ISCLClient } from "../../shared/iscl-client.js";
import { ISCLError } from "../../shared/iscl-client.js";
import type { BalanceParams, SkillResult } from "../types.js";

export async function handleBalance(
  params: BalanceParams,
  client: ISCLClient,
): Promise<SkillResult> {
  try {
    const result = await client.balance(params.tokenAddress, params.walletAddress);

    return {
      success: true,
      data: {
        token: result.token,
        account: result.account,
        balance: result.balance,
      },
    };
  } catch (err) {
    if (err instanceof ISCLError) {
      return { success: false, error: err.message };
    }
    throw err;
  }
}
