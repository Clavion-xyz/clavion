import type { PendingApprovalItem, BalanceResponse, TxReceiptResponse } from "../shared/iscl-client.js";

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function riskEmoji(score: number): string {
  if (score <= 30) return "\u{1F7E2}"; // green
  if (score <= 60) return "\u{1F7E1}"; // yellow
  return "\u{1F534}";                   // red
}

function riskBar(score: number): string {
  const filled = Math.round(score / 10);
  return "\u{2588}".repeat(filled) + "\u{2591}".repeat(10 - filled);
}

function formatCountdown(expiresAt: number): string {
  const remaining = Math.max(0, expiresAt - Date.now());
  const secs = Math.ceil(remaining / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function formatApprovalCard(item: PendingApprovalItem): string {
  const s = item.summary;
  const lines: string[] = [];

  lines.push("<b>Transaction Approval Required</b>");
  lines.push("");
  lines.push(`<b>Action:</b> ${escHtml(s.action)}`);
  lines.push(`<b>Outcome:</b> ${escHtml(s.expectedOutcome)}`);

  if (s.recipient) {
    lines.push(`<b>To:</b> <code>${escHtml(s.recipient)}</code>`);
  }
  if (s.spender) {
    lines.push(`<b>Spender:</b> <code>${escHtml(s.spender)}</code>`);
  }

  lines.push("");
  lines.push(`<b>Risk:</b> ${s.riskScore}/100 ${riskEmoji(s.riskScore)} ${riskBar(s.riskScore)}`);
  lines.push(`<b>Gas:</b> ${escHtml(s.gasEstimateEth)}`);

  if (s.balanceDiffs.length > 0) {
    lines.push("");
    lines.push("<b>Balance changes:</b>");
    for (const d of s.balanceDiffs) {
      const prefix = d.delta.startsWith("-") || d.delta.startsWith("+") ? "" : "+";
      const usd = d.usdValue ? ` (~$${escHtml(d.usdValue)})` : "";
      lines.push(`  ${prefix}${escHtml(d.delta)} ${escHtml(d.asset)}${usd}`);
    }
  }

  if (s.warnings.length > 0) {
    lines.push("");
    for (const w of s.warnings) {
      lines.push(`\u{26A0}\u{FE0F} ${escHtml(w)}`);
    }
  }

  lines.push("");
  lines.push(`\u{23F1} Expires in ${formatCountdown(item.expiresAt)}`);

  return lines.join("\n");
}

export interface SuccessMessageData {
  intentId: string;
  txHash: string;
  broadcast: boolean;
  broadcastError?: string;
}

export function formatSuccessMessage(data: SuccessMessageData): string {
  const lines: string[] = [];
  lines.push("\u{2705} <b>Transaction Sent</b>");
  lines.push("");
  lines.push(`<b>TX Hash:</b> <code>${escHtml(data.txHash)}</code>`);

  if (data.broadcast) {
    lines.push("<b>Status:</b> Broadcast to network");
  } else if (data.broadcastError) {
    lines.push(`<b>Status:</b> Signed but broadcast failed: ${escHtml(data.broadcastError)}`);
  } else {
    lines.push("<b>Status:</b> Signed (no RPC for broadcast)");
  }

  return lines.join("\n");
}

export function formatDeniedMessage(): string {
  return "\u{274C} Transaction denied.";
}

export function formatErrorMessage(err: unknown): string {
  if (typeof err === "string") {
    return `\u{274C} <b>Error:</b> ${escHtml(err)}`;
  }
  if (err instanceof Error) {
    return `\u{274C} <b>Error:</b> ${escHtml(err.message)}`;
  }
  return "\u{274C} <b>Error:</b> An unknown error occurred.";
}

export function formatBalanceMessage(resp: BalanceResponse): string {
  return [
    "<b>Balance</b>",
    "",
    `<b>Token:</b> <code>${escHtml(resp.token)}</code>`,
    `<b>Account:</b> <code>${escHtml(resp.account)}</code>`,
    `<b>Balance:</b> ${escHtml(resp.balance)}`,
  ].join("\n");
}

export function formatReceiptMessage(resp: TxReceiptResponse): string {
  const statusEmoji = resp.status === "success" ? "\u{2705}" : "\u{274C}";
  return [
    `${statusEmoji} <b>Transaction ${escHtml(resp.status)}</b>`,
    "",
    `<b>Hash:</b> <code>${escHtml(resp.transactionHash)}</code>`,
    `<b>Block:</b> ${escHtml(resp.blockNumber)}`,
    `<b>Gas Used:</b> ${escHtml(resp.gasUsed)}`,
    `<b>From:</b> <code>${escHtml(truncAddr(resp.from))}</code>`,
    resp.to ? `<b>To:</b> <code>${escHtml(truncAddr(resp.to))}</code>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatHelp(): string {
  return [
    "<b>Clavion Telegram Bot</b>",
    "",
    "Commands:",
    "/transfer &lt;amount&gt; &lt;tokenAddr&gt; to &lt;recipientAddr&gt;",
    "/send &lt;amount&gt; to &lt;recipientAddr&gt; (native ETH)",
    "/swap &lt;amountIn&gt; &lt;tokenInAddr&gt; for &lt;tokenOutAddr&gt;",
    "/approve &lt;amount&gt; &lt;tokenAddr&gt; for &lt;spenderAddr&gt;",
    "/balance &lt;tokenAddr&gt; &lt;accountAddr&gt;",
    "/status &lt;txHash&gt;",
    "/help",
    "",
    "Addresses must be full 0x... format.",
    "Amounts are in raw token units (e.g., 1000000 for 1 USDC).",
  ].join("\n");
}
