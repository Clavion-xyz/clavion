import type { ISCLClient } from "./iscl-client.js";
import type { TxIntent } from "@clavion/types";

export interface PipelineResult {
  success: boolean;
  intentId: string;
  approved: boolean;
  txHash?: string;
  broadcast?: boolean;
  broadcastError?: string;
  description?: string;
  riskScore?: number;
  riskReasons?: string[];
  declineReason?: string;
  error?: string;
}

export async function executeSecurePipeline(
  intent: TxIntent,
  client: ISCLClient,
): Promise<PipelineResult> {
  // Step 1: approve-request (policy + preflight + user prompt)
  const approval = await client.txApproveRequest(intent);

  if (!approval.approved) {
    return {
      success: false,
      intentId: approval.intentId,
      approved: false,
      description: approval.description,
      riskScore: approval.riskScore,
      riskReasons: approval.riskReasons,
      declineReason: approval.reason ?? "user_declined",
    };
  }

  // Step 2: sign-and-send (with single-use approval token)
  const signed = await client.txSignAndSend({
    intent,
    approvalTokenId: approval.approvalTokenId,
  });

  return {
    success: true,
    intentId: signed.intentId,
    approved: true,
    txHash: signed.txHash,
    broadcast: signed.broadcast,
    broadcastError: signed.broadcastError,
    description: approval.description,
    riskScore: approval.riskScore,
    riskReasons: approval.riskReasons,
  };
}
