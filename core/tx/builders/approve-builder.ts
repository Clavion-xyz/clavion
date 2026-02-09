import { encodeFunctionData } from "viem";
import type { TxIntent, ApproveAction, BuildPlan } from "../../types.js";
import { computeTxRequestHash } from "./build-utils.js";

const erc20ApproveAbi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const MAX_UINT256 = 2n ** 256n - 1n;

export function buildApprove(intent: TxIntent): BuildPlan {
  const action = intent.action as ApproveAction;
  if (action.type !== "approve") {
    throw new Error(`Expected approve action, got ${action.type}`);
  }

  const data = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [action.spender as `0x${string}`, BigInt(action.amount)],
  });

  const txRequest = {
    to: action.asset.address as `0x${string}`,
    data,
    value: 0n,
    chainId: intent.chain.chainId,
    type: "eip1559" as const,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
  };

  const isUnlimited = BigInt(action.amount) === MAX_UINT256;
  const amountDesc = isUnlimited ? "UNLIMITED" : action.amount;

  return {
    intentId: intent.id,
    txRequest,
    txRequestHash: computeTxRequestHash(txRequest),
    description: `Approve ${amountDesc} ${action.asset.symbol ?? "tokens"} for ${action.spender}`,
  };
}
