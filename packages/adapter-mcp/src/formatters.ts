import type { PipelineResult } from "./tools/pipeline.js";

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function formatPipelineResult(
  result: PipelineResult,
  actionLabel: string,
): McpToolResult {
  if (!result.success) {
    const lines: string[] = [
      `${actionLabel} — DECLINED`,
      `Intent ID: ${result.intentId}`,
    ];

    if (result.declineReason) {
      lines.push(`Reason: ${result.declineReason}`);
    }

    if (result.approvalDetails) {
      lines.push(`Policy decision: ${result.approvalDetails.policyDecision}`);
      if (result.approvalDetails.policyReasons.length > 0) {
        lines.push(
          `Policy reasons: ${result.approvalDetails.policyReasons.join(", ")}`,
        );
      }
      lines.push(`Risk score: ${result.approvalDetails.riskScore}/100`);
      if (result.approvalDetails.riskReasons.length > 0) {
        lines.push(
          `Risk factors: ${result.approvalDetails.riskReasons.join(", ")}`,
        );
      }
      if (result.approvalDetails.warnings.length > 0) {
        lines.push(
          `Warnings: ${result.approvalDetails.warnings.join(", ")}`,
        );
      }
    }

    return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
  }

  const lines: string[] = [
    `${actionLabel} — SUCCESS`,
    `Intent ID: ${result.intentId}`,
  ];

  if (result.approvalDetails) {
    lines.push(`Description: ${result.approvalDetails.description}`);
    lines.push(`Risk score: ${result.approvalDetails.riskScore}/100`);
    lines.push(`Gas estimate: ${result.approvalDetails.gasEstimate} wei`);
  }

  if (result.signResult) {
    lines.push(`Transaction hash: ${result.signResult.txHash}`);
    lines.push(
      `Broadcast: ${result.signResult.broadcast ? "yes" : "no (sign-only mode)"}`,
    );
    if (result.signResult.broadcastError) {
      lines.push(`Broadcast error: ${result.signResult.broadcastError}`);
    }
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export function formatError(error: unknown): McpToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}
