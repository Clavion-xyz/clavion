import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { ApprovalTokenManager } from "./approval-token-manager.js";
import type { AuditTraceService } from "../audit/audit-trace-service.js";
import type { ApprovalSummary, ApprovalResult } from "../types.js";

export type PromptFn = () => Promise<boolean>;

async function defaultPrompt(): Promise<boolean> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question("\nApprove this transaction? (yes/no): ");
    const normalized = answer.trim().toLowerCase();
    return normalized === "yes" || normalized === "y";
  } finally {
    rl.close();
  }
}

export class ApprovalService {
  private promptFn: PromptFn;

  constructor(
    private tokenManager: ApprovalTokenManager,
    private auditTrace: AuditTraceService,
    promptFn?: PromptFn,
  ) {
    this.promptFn = promptFn ?? defaultPrompt;
  }

  async requestApproval(summary: ApprovalSummary): Promise<ApprovalResult> {
    this.renderSummary(summary);

    const confirmed = await this.promptFn();

    if (!confirmed) {
      this.auditTrace.log("approval_rejected", {
        intentId: summary.intentId,
        action: summary.action,
        reason: "user_declined",
      });
      return { approved: false };
    }

    const token = this.tokenManager.issue(summary.intentId, summary.txRequestHash, 300);

    this.auditTrace.log("approval_granted", {
      intentId: summary.intentId,
      action: summary.action,
      tokenId: token.id,
      riskScore: summary.riskScore,
    });

    return { approved: true, token };
  }

  renderSummary(summary: ApprovalSummary): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("=".repeat(60));
    lines.push("  TRANSACTION APPROVAL REQUEST");
    lines.push("=".repeat(60));
    lines.push("");
    lines.push(`  Action:   ${summary.action}`);
    lines.push(`  Expected: ${summary.expectedOutcome}`);

    if (summary.recipient) {
      lines.push(`  To:       ${summary.recipient}`);
    }
    if (summary.spender) {
      lines.push(`  Spender:  ${summary.spender}`);
    }

    if (summary.balanceDiffs.length > 0) {
      lines.push("");
      lines.push("  Balance Changes:");
      for (const diff of summary.balanceDiffs) {
        const prefix = diff.delta.startsWith("-") || diff.delta.startsWith("+") ? "" : "+";
        const usd = diff.usdValue ? ` (~$${diff.usdValue})` : "";
        lines.push(`    ${prefix}${diff.delta} ${diff.asset}${usd}`);
      }
    }

    lines.push("");
    lines.push(`  Gas Estimate: ${summary.gasEstimateEth}`);
    lines.push(`  Risk Score:   ${summary.riskScore}/100`);

    if (summary.riskReasons.length > 0) {
      lines.push("");
      lines.push("  Risk Factors:");
      for (const reason of summary.riskReasons) {
        lines.push(`    - ${reason}`);
      }
    }

    if (summary.warnings.length > 0) {
      lines.push("");
      lines.push("  WARNINGS:");
      for (const warning of summary.warnings) {
        lines.push(`    ! ${warning}`);
      }
    }

    lines.push("");
    lines.push("=".repeat(60));

    const output = lines.join("\n");
    console.log(output);
    return output;
  }
}
