import { encodeFunctionData } from "viem";
import type { TxIntent, TransferAction, BuildPlan } from "../../types.js";
import { computeTxRequestHash } from "./build-utils.js";

const erc20TransferAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function buildTransfer(intent: TxIntent): BuildPlan {
  const action = intent.action as TransferAction;
  if (action.type !== "transfer") {
    throw new Error(`Expected transfer action, got ${action.type}`);
  }

  const data = encodeFunctionData({
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [action.to as `0x${string}`, BigInt(action.amount)],
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

  return {
    intentId: intent.id,
    txRequest,
    txRequestHash: computeTxRequestHash(txRequest),
    description: `Transfer ${action.amount} ${action.asset.symbol ?? "tokens"} to ${action.to}`,
  };
}
