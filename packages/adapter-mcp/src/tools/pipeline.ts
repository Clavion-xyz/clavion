import type {
  ISCLClient,
  ApproveRequestResponse,
} from "../shared/iscl-client.js";
import type { TxIntent } from "@clavion/types";

export interface ApprovalDetails {
  riskScore: number;
  riskReasons: string[];
  warnings: string[];
  gasEstimate: string;
  description: string;
  policyDecision: string;
  policyReasons: string[];
}

export interface SignResult {
  txHash: string;
  signedTx: string;
  broadcast: boolean;
  broadcastError?: string;
}

export interface PipelineResult {
  success: boolean;
  intentId: string;
  approved: boolean;
  approvalDetails?: ApprovalDetails;
  signResult?: SignResult;
  declineReason?: string;
}

function extractApprovalDetails(
  approval: ApproveRequestResponse,
): ApprovalDetails {
  return {
    riskScore: approval.riskScore,
    riskReasons: approval.riskReasons,
    warnings: approval.warnings,
    gasEstimate: approval.gasEstimate,
    description: approval.description,
    policyDecision: approval.policyDecision.decision,
    policyReasons: approval.policyDecision.reasons,
  };
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
      approvalDetails: extractApprovalDetails(approval),
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
    approvalDetails: extractApprovalDetails(approval),
    signResult: {
      txHash: signed.txHash,
      signedTx: signed.signedTx,
      broadcast: signed.broadcast,
      broadcastError: signed.broadcastError,
    },
  };
}
