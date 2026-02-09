import type { TxIntent, PolicyConfig, PolicyDecision } from "@clavion/types";

export interface EvaluateOptions {
  riskScore?: number;
  recentTxCount?: number;
}

export function evaluate(
  intent: TxIntent,
  config: PolicyConfig,
  options?: EvaluateOptions,
): PolicyDecision {
  const reasons: string[] = [];
  let shouldDeny = false;
  let shouldRequireApproval = false;

  // 1. Chain restriction
  if (!config.allowedChains.includes(intent.chain.chainId)) {
    shouldDeny = true;
    reasons.push(
      `Chain ${intent.chain.chainId} not in allowed chains [${config.allowedChains.join(", ")}]`,
    );
  }

  // 2. Token allowlist
  const tokens = extractTokenAddresses(intent);
  for (const token of tokens) {
    if (
      config.tokenAllowlist.length > 0 &&
      !config.tokenAllowlist.some(
        (t) => t.toLowerCase() === token.toLowerCase(),
      )
    ) {
      shouldDeny = true;
      reasons.push(`Token ${token} not in allowlist`);
    }
  }

  // 3. Contract allowlist (router/spender)
  const contractAddress = extractContractAddress(intent);
  if (contractAddress && config.contractAllowlist.length > 0) {
    if (
      !config.contractAllowlist.some(
        (c) => c.toLowerCase() === contractAddress.toLowerCase(),
      )
    ) {
      shouldDeny = true;
      reasons.push(`Contract ${contractAddress} not in allowlist`);
    }
  }

  // 4. Value limit
  const value = extractValue(intent);
  if (value !== undefined) {
    if (
      BigInt(config.maxValueWei) > 0n &&
      BigInt(value) > BigInt(config.maxValueWei)
    ) {
      shouldDeny = true;
      reasons.push(`Value ${value} exceeds max ${config.maxValueWei}`);
    }

    if (BigInt(value) > BigInt(config.requireApprovalAbove.valueWei)) {
      shouldRequireApproval = true;
      reasons.push(
        `Value ${value} exceeds approval threshold ${config.requireApprovalAbove.valueWei}`,
      );
    }
  }

  // 5. Approval amount limit
  if (intent.action.type === "approve") {
    const amount = BigInt(intent.action.amount);
    if (
      BigInt(config.maxApprovalAmount) > 0n &&
      amount > BigInt(config.maxApprovalAmount)
    ) {
      shouldDeny = true;
      reasons.push(
        `Approval amount ${intent.action.amount} exceeds max ${config.maxApprovalAmount}`,
      );
    }
  }

  // 6. Recipient allowlist (transfers only, if list is non-empty)
  if (
    (intent.action.type === "transfer" || intent.action.type === "transfer_native") &&
    config.recipientAllowlist.length > 0
  ) {
    const recipient = intent.action.to;
    if (
      !config.recipientAllowlist.some(
        (r) => r.toLowerCase() === recipient.toLowerCase(),
      )
    ) {
      shouldDeny = true;
      reasons.push(`Recipient ${recipient} not in allowlist`);
    }
  }

  // 7. Risk score check (from preflight, if provided)
  if (
    options?.riskScore !== undefined &&
    options.riskScore > config.maxRiskScore
  ) {
    shouldRequireApproval = true;
    reasons.push(
      `Risk score ${options.riskScore} exceeds max ${config.maxRiskScore}`,
    );
  }

  // 8. Rate limit check
  if (
    options?.recentTxCount !== undefined &&
    options.recentTxCount >= config.maxTxPerHour
  ) {
    shouldDeny = true;
    reasons.push(
      `Rate limit exceeded: ${options.recentTxCount} transactions in the past hour (limit: ${config.maxTxPerHour})`,
    );
  }

  // Decision priority: deny > require_approval > allow
  if (shouldDeny) {
    return { decision: "deny", reasons, policyVersion: config.version };
  }
  if (shouldRequireApproval) {
    return {
      decision: "require_approval",
      reasons,
      policyVersion: config.version,
    };
  }

  if (reasons.length === 0) {
    reasons.push("All checks passed");
  }
  return { decision: "allow", reasons, policyVersion: config.version };
}

function extractTokenAddresses(intent: TxIntent): string[] {
  const action = intent.action;
  switch (action.type) {
    case "transfer":
    case "approve":
      return [action.asset.address];
    case "swap_exact_in":
    case "swap_exact_out":
      return [action.assetIn.address, action.assetOut.address];
    default:
      return [];
  }
}

function extractContractAddress(intent: TxIntent): string | undefined {
  const action = intent.action;
  switch (action.type) {
    case "approve":
      return action.spender;
    case "swap_exact_in":
    case "swap_exact_out":
      return action.router;
    default:
      return undefined;
  }
}

function extractValue(intent: TxIntent): string | undefined {
  const action = intent.action;
  switch (action.type) {
    case "transfer":
    case "transfer_native":
      return action.amount;
    case "approve":
      return action.amount;
    case "swap_exact_in":
      return action.amountIn;
    case "swap_exact_out":
      return action.maxAmountIn;
    default:
      return undefined;
  }
}
