import type {
  TxIntent,
  BuildPlan,
  PolicyConfig,
  PreflightResult,
  BalanceDiff,
  AllowanceChange,
  RiskContext,
} from "@clavion/types";
import type { RpcClient } from "@clavion/types/rpc";
import { computeRiskScore } from "./risk-scorer.js";

export class PreflightService {
  constructor(
    private rpcClient: RpcClient,
    private policyConfig: PolicyConfig,
  ) {}

  async simulate(
    intent: TxIntent,
    buildPlan: BuildPlan,
  ): Promise<PreflightResult> {
    const { txRequest } = buildPlan;
    const from = intent.wallet.address as `0x${string}`;
    const to = txRequest.to as `0x${string}`;
    const data = txRequest.data as `0x${string}`;
    const value = txRequest.value ?? 0n;

    // 1. Simulate the call
    const callResult = await this.rpcClient.call({ to, data, from, value });

    // 2. Estimate gas
    let gasEstimate = 0n;
    try {
      gasEstimate = await this.rpcClient.estimateGas({ to, data, from, value });
    } catch {
      // If estimation fails and simulation also failed, use a default
      if (!callResult.success) {
        gasEstimate = 0n;
      }
    }

    // 3. Collect balance diffs
    const balanceDiffs = await this.collectBalanceDiffs(intent, from);

    // 4. Collect allowance changes
    const allowanceChanges = await this.collectAllowanceChanges(intent, from);

    // 5. Compute risk score
    const riskContext = this.buildRiskContext(
      intent,
      callResult.success,
      gasEstimate,
    );
    const risk = computeRiskScore(riskContext);

    // 6. Generate warnings
    const warnings: string[] = [];
    if (!callResult.success) {
      warnings.push(
        `Simulation reverted: ${callResult.revertReason ?? "unknown reason"}`,
      );
    }
    if (risk.score >= this.policyConfig.maxRiskScore) {
      warnings.push(`Risk score ${risk.score} exceeds threshold ${this.policyConfig.maxRiskScore}`);
    }
    if (gasEstimate > 500_000n) {
      warnings.push(`High gas estimate: ${gasEstimate.toString()}`);
    }

    return {
      intentId: intent.id,
      simulationSuccess: callResult.success,
      revertReason: callResult.revertReason,
      gasEstimate: gasEstimate.toString(),
      balanceDiffs,
      allowanceChanges,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      warnings,
    };
  }

  private async collectBalanceDiffs(
    intent: TxIntent,
    from: `0x${string}`,
  ): Promise<BalanceDiff[]> {
    const diffs: BalanceDiff[] = [];
    const action = intent.action;

    if (action.type === "transfer_native") {
      const balance = await this.rpcClient.readNativeBalance(from);
      diffs.push({
        asset: "ETH",
        delta: `-${action.amount}`,
        before: balance.toString(),
        after: (balance - BigInt(action.amount)).toString(),
      });
    } else if (action.type === "transfer") {
      const token = action.asset.address as `0x${string}`;
      const balance = await this.rpcClient.readBalance(token, from);
      diffs.push({
        asset: action.asset.symbol ?? action.asset.address,
        delta: `-${action.amount}`,
        before: balance.toString(),
        after: (balance - BigInt(action.amount)).toString(),
      });
    } else if (action.type === "swap_exact_in") {
      const tokenIn = action.assetIn.address as `0x${string}`;
      const balanceIn = await this.rpcClient.readBalance(tokenIn, from);
      diffs.push({
        asset: action.assetIn.symbol ?? action.assetIn.address,
        delta: `-${action.amountIn}`,
        before: balanceIn.toString(),
        after: (balanceIn - BigInt(action.amountIn)).toString(),
      });
    } else if (action.type === "swap_exact_out") {
      const tokenIn = action.assetIn.address as `0x${string}`;
      const balanceIn = await this.rpcClient.readBalance(tokenIn, from);
      diffs.push({
        asset: action.assetIn.symbol ?? action.assetIn.address,
        delta: `-${action.maxAmountIn} (max)`,
        before: balanceIn.toString(),
        after: (balanceIn - BigInt(action.maxAmountIn)).toString(),
      });
    }

    return diffs;
  }

  private async collectAllowanceChanges(
    intent: TxIntent,
    from: `0x${string}`,
  ): Promise<AllowanceChange[]> {
    if (intent.action.type !== "approve") return [];

    const action = intent.action;
    const token = action.asset.address as `0x${string}`;
    const spender = action.spender as `0x${string}`;
    const currentAllowance = await this.rpcClient.readAllowance(
      token,
      from,
      spender,
    );

    return [
      {
        token: action.asset.address,
        spender: action.spender,
        before: currentAllowance.toString(),
        after: action.amount,
      },
    ];
  }

  private buildRiskContext(
    intent: TxIntent,
    simulationSuccess: boolean,
    gasEstimate: bigint,
  ): RiskContext {
    const action = intent.action;

    const tokens = this.extractTokenAddresses(intent);
    const tokenInAllowlist = tokens.every(
      (t) =>
        this.policyConfig.tokenAllowlist.length === 0 ||
        this.policyConfig.tokenAllowlist.some(
          (a) => a.toLowerCase() === t.toLowerCase(),
        ),
    );

    const contractAddress = this.extractContractAddress(intent);
    const contractInAllowlist =
      !contractAddress ||
      this.policyConfig.contractAllowlist.length === 0 ||
      this.policyConfig.contractAllowlist.some(
        (c) => c.toLowerCase() === contractAddress.toLowerCase(),
      );

    const context: RiskContext = {
      contractInAllowlist,
      tokenInAllowlist,
      slippageBps: intent.constraints.maxSlippageBps,
      simulationReverted: !simulationSuccess,
      gasEstimate,
      maxValueWei:
        BigInt(this.policyConfig.maxValueWei) > 0n
          ? BigInt(this.policyConfig.maxValueWei)
          : undefined,
      maxApprovalAmount:
        BigInt(this.policyConfig.maxApprovalAmount) > 0n
          ? BigInt(this.policyConfig.maxApprovalAmount)
          : undefined,
    };

    if (action.type === "transfer" || action.type === "transfer_native") {
      context.valueWei = BigInt(action.amount);
    } else if (action.type === "approve") {
      context.approvalAmount = BigInt(action.amount);
    } else if (action.type === "swap_exact_in") {
      context.valueWei = BigInt(action.amountIn);
    } else if (action.type === "swap_exact_out") {
      context.valueWei = BigInt(action.maxAmountIn);
    }

    return context;
  }

  private extractTokenAddresses(intent: TxIntent): string[] {
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

  private extractContractAddress(intent: TxIntent): string | undefined {
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
}
