import { randomUUID } from "node:crypto";
import type { TxIntent, ActionObject } from "@clavion/types";

export interface IntentBuilderOptions {
  walletAddress: string;
  action: ActionObject;
  chainId?: number;
  rpcHint?: string;
  maxGasWei?: string;
  deadline?: number;
  slippageBps?: number;
  source?: string;
}

export function buildIntent(options: IntentBuilderOptions): TxIntent {
  const now = Math.floor(Date.now() / 1000);
  return {
    version: "1",
    id: randomUUID(),
    timestamp: now,
    chain: {
      type: "evm",
      chainId: options.chainId ?? 8453,
      ...(options.rpcHint ? { rpcHint: options.rpcHint } : {}),
    },
    wallet: { address: options.walletAddress },
    action: options.action,
    constraints: {
      maxGasWei: options.maxGasWei ?? "1000000000000000",
      deadline: options.deadline ?? now + 600,
      maxSlippageBps: options.slippageBps ?? 100,
    },
    metadata: { source: options.source ?? "clavion-adapter" },
  };
}
