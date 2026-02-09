import type { FastifyInstance } from "fastify";
import { TxIntentSchema } from "../../../spec/schemas/txintent-schema.js";
import { buildFromIntent } from "../../tx/builders/index.js";
import { evaluate } from "../../policy/policy-engine.js";
import type {
  PolicyConfig,
  TxIntent,
  BuildPlan,
  ApprovalSummary,
  BalanceDiff,
} from "../../types.js";
import type { PreflightService } from "../../preflight/preflight-service.js";
import type { AuditTraceService } from "../../audit/audit-trace-service.js";
import type { WalletService } from "../../wallet/wallet-service.js";
import type { ApprovalTokenManager } from "../../approval/approval-token-manager.js";
import type { ApprovalService } from "../../approval/approval-service.js";
import type { RpcClient } from "../../rpc/rpc-client.js";

export interface TxRouteServices {
  policyConfig: PolicyConfig;
  preflightService: PreflightService | null;
  auditTrace: AuditTraceService;
  walletService: WalletService;
  approvalTokenManager: ApprovalTokenManager;
  approvalService: ApprovalService;
  rpcClient: RpcClient | null;
}

/** Serialize BuildPlan for JSON response — converts BigInt fields to strings. */
function serializeBuildPlan(plan: BuildPlan): Record<string, unknown> {
  return {
    intentId: plan.intentId,
    txRequestHash: plan.txRequestHash,
    description: plan.description,
    txRequest: JSON.parse(
      JSON.stringify(plan.txRequest, (_key, value) =>
        typeof value === "bigint" ? value.toString() : (value as unknown),
      ),
    ) as unknown,
  };
}

/** Build an ApprovalSummary from intent + build plan + preflight data. */
function buildApprovalSummary(
  intent: TxIntent,
  plan: BuildPlan,
  preflight: {
    riskScore: number;
    riskReasons: string[];
    warnings: string[];
    gasEstimate: string;
    balanceDiffs: BalanceDiff[];
  },
): ApprovalSummary {
  const action = intent.action;
  let actionStr: string;
  let recipient: string | undefined;
  let spender: string | undefined;
  let expectedOutcome: string;

  switch (action.type) {
    case "transfer":
      actionStr = "transfer";
      recipient = action.to;
      expectedOutcome = `Transfer ${action.amount} ${action.asset.symbol ?? action.asset.address} to ${action.to}`;
      break;
    case "transfer_native":
      actionStr = "transfer_native";
      recipient = action.to;
      expectedOutcome = `Transfer ${action.amount} wei native ETH to ${action.to}`;
      break;
    case "approve":
      actionStr = "approve";
      spender = action.spender;
      expectedOutcome = `Approve ${action.spender} to spend ${action.amount} ${action.asset.symbol ?? action.asset.address}`;
      break;
    case "swap_exact_in":
      actionStr = "swap_exact_in";
      expectedOutcome = `Swap ${action.amountIn} ${action.assetIn.symbol ?? action.assetIn.address} for min ${action.minAmountOut} ${action.assetOut.symbol ?? action.assetOut.address}`;
      break;
    case "swap_exact_out":
      actionStr = "swap_exact_out";
      expectedOutcome = `Swap max ${action.maxAmountIn} ${action.assetIn.symbol ?? action.assetIn.address} for ${action.amountOut} ${action.assetOut.symbol ?? action.assetOut.address}`;
      break;
  }

  return {
    intentId: intent.id,
    action: actionStr,
    recipient,
    spender,
    expectedOutcome,
    balanceDiffs: preflight.balanceDiffs,
    riskScore: preflight.riskScore,
    riskReasons: preflight.riskReasons,
    warnings: preflight.warnings,
    gasEstimateEth: `${preflight.gasEstimate} gas`,
    txRequestHash: plan.txRequestHash,
  };
}

export function createTxRoutes(services: TxRouteServices) {
  return async function txRoutes(app: FastifyInstance): Promise<void> {
    const {
      policyConfig,
      preflightService,
      auditTrace,
      walletService,
      approvalTokenManager,
      approvalService,
      rpcClient,
    } = services;

    // POST /v1/tx/build — Build transaction from TxIntent
    app.post("/v1/tx/build", {
      schema: {
        body: TxIntentSchema,
      },
      handler: async (request, reply) => {
        const intent = request.body as TxIntent;

        // Policy check (with rate limit count)
        const recentTxCount = auditTrace.countRecentTxByWallet(
          intent.wallet.address,
          3_600_000,
        );
        const decision = evaluate(intent, policyConfig, { recentTxCount });

        auditTrace.log("policy_evaluated", {
          intentId: intent.id,
          decision: decision.decision,
          reasons: decision.reasons,
        });

        if (decision.decision === "deny") {
          return reply.code(403).send({
            error: "policy_denied",
            decision: decision.decision,
            reasons: decision.reasons,
            policyVersion: decision.policyVersion,
          });
        }

        // Record rate limit tick (non-denied)
        auditTrace.recordRateLimitTick(intent.wallet.address);

        // Build the transaction
        const plan = buildFromIntent(intent);

        auditTrace.log("tx_built", {
          intentId: intent.id,
          txRequestHash: plan.txRequestHash,
          description: plan.description,
        });

        return reply.code(200).send({
          ...serializeBuildPlan(plan),
          policyDecision: decision,
        });
      },
    });

    // POST /v1/tx/preflight — Simulate and score risk
    app.post("/v1/tx/preflight", {
      schema: {
        body: TxIntentSchema,
      },
      handler: async (request, reply) => {
        const intent = request.body as TxIntent;

        if (!preflightService) {
          return reply.code(502).send({
            error: "no_rpc_client",
            message: "PreflightService requires an RPC client, which is not configured.",
          });
        }

        const plan = buildFromIntent(intent);
        const result = await preflightService.simulate(intent, plan);

        auditTrace.log("preflight_completed", {
          intentId: intent.id,
          simulationSuccess: result.simulationSuccess,
          riskScore: result.riskScore,
          gasEstimate: result.gasEstimate,
        });

        return reply.code(200).send(result);
      },
    });

    // POST /v1/tx/approve-request — Generate approval summary, prompt user if needed, issue token
    app.post("/v1/tx/approve-request", {
      schema: {
        body: TxIntentSchema,
      },
      handler: async (request, reply) => {
        const intent = request.body as TxIntent;

        // Build the transaction
        const plan = buildFromIntent(intent);

        // Run preflight if available (to get risk score)
        let riskScore = 0;
        let riskReasons: string[] = [];
        let warnings: string[] = [];
        let gasEstimate = "0";
        let balanceDiffs: BalanceDiff[] = [];

        if (preflightService) {
          const preflight = await preflightService.simulate(intent, plan);
          riskScore = preflight.riskScore;
          riskReasons = preflight.riskReasons;
          warnings = preflight.warnings;
          gasEstimate = preflight.gasEstimate;
          balanceDiffs = preflight.balanceDiffs;
        }

        // Policy check (with risk score from preflight + rate limit)
        const recentTxCount = auditTrace.countRecentTxByWallet(
          intent.wallet.address,
          3_600_000,
        );
        const decision = evaluate(intent, policyConfig, { riskScore, recentTxCount });

        auditTrace.log("approve_request_created", {
          intentId: intent.id,
          decision: decision.decision,
          riskScore,
        });

        if (decision.decision === "deny") {
          return reply.code(403).send({
            error: "policy_denied",
            decision: decision.decision,
            reasons: decision.reasons,
            policyVersion: decision.policyVersion,
          });
        }

        // Record rate limit tick (non-denied)
        auditTrace.recordRateLimitTick(intent.wallet.address);

        const baseResponse = {
          intentId: intent.id,
          txRequestHash: plan.txRequestHash,
          description: plan.description,
          policyDecision: decision,
          riskScore,
          riskReasons,
          warnings,
          gasEstimate,
          balanceDiffs,
        };

        // Policy says "allow" — no approval prompt needed
        if (decision.decision === "allow") {
          return reply.code(200).send({
            ...baseResponse,
            approvalRequired: false,
            approved: true,
          });
        }

        // Policy says "require_approval" — prompt the user in the terminal
        const summary = buildApprovalSummary(intent, plan, {
          riskScore,
          riskReasons,
          warnings,
          gasEstimate,
          balanceDiffs,
        });

        const approvalResult = await approvalService.requestApproval(summary);

        if (!approvalResult.approved) {
          return reply.code(403).send({
            ...baseResponse,
            approvalRequired: true,
            approved: false,
            reason: "user_declined",
          });
        }

        return reply.code(200).send({
          ...baseResponse,
          approvalRequired: true,
          approved: true,
          approvalTokenId: approvalResult.token!.id,
        });
      },
    });

    // POST /v1/tx/sign-and-send — Sign and optionally broadcast transaction
    // Hoist $defs from TxIntentSchema to root so $ref resolves correctly when nested
    const { $defs: intentDefs, ...intentSchemaBody } = TxIntentSchema as Record<string, unknown>;
    app.post<{
      Body: { intent: TxIntent; approvalTokenId?: string };
    }>("/v1/tx/sign-and-send", {
      schema: {
        body: {
          type: "object",
          required: ["intent"],
          additionalProperties: false,
          $defs: intentDefs,
          properties: {
            intent: intentSchemaBody,
            approvalTokenId: { type: "string", format: "uuid" },
          },
        },
      },
      handler: async (request, reply) => {
        const { intent, approvalTokenId } = request.body;

        // Build the transaction
        const plan = buildFromIntent(intent);

        // Policy check (with rate limit count)
        const recentTxCount = auditTrace.countRecentTxByWallet(
          intent.wallet.address,
          3_600_000,
        );
        const decision = evaluate(intent, policyConfig, { recentTxCount });

        if (decision.decision === "deny") {
          return reply.code(403).send({
            error: "policy_denied",
            reasons: decision.reasons,
          });
        }

        // Record rate limit tick (non-denied)
        auditTrace.recordRateLimitTick(intent.wallet.address);

        // Resolve approval token if needed
        let approvalToken;
        if (decision.decision === "require_approval") {
          if (!approvalTokenId) {
            return reply.code(403).send({
              error: "approval_required",
              message: "This transaction requires an approval token.",
              txRequestHash: plan.txRequestHash,
            });
          }
          approvalToken = approvalTokenManager.get(approvalTokenId);
          if (!approvalToken) {
            return reply.code(403).send({
              error: "invalid_approval_token",
              message: "Approval token not found or expired.",
            });
          }
        }

        // Populate nonce and gas from RPC if available (required for broadcast)
        const txRequest = { ...plan.txRequest };
        if (rpcClient) {
          try {
            const [nonce, gasEstimate, fees] = await Promise.all([
              rpcClient.getTransactionCount(intent.wallet.address as `0x${string}`),
              rpcClient.estimateGas({
                to: plan.txRequest.to!,
                data: plan.txRequest.data!,
                from: intent.wallet.address as `0x${string}`,
                value: plan.txRequest.value ?? 0n,
              }),
              rpcClient.estimateFeesPerGas(),
            ]);
            txRequest.nonce = nonce;
            txRequest.gas = gasEstimate;
            txRequest.maxFeePerGas = fees.maxFeePerGas;
            txRequest.maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
          } catch {
            // Non-fatal: proceed with builder defaults (broadcast may fail)
          }
        }

        // Sign
        try {
          const signed = await walletService.sign({
            intentId: intent.id,
            walletAddress: intent.wallet.address,
            txRequest,
            txRequestHash: plan.txRequestHash,
            policyDecision: decision,
            approvalToken,
          });

          // Attempt broadcast if RPC client is available
          let broadcast = false;
          let broadcastError: string | undefined;

          if (rpcClient) {
            try {
              await rpcClient.sendRawTransaction(signed.signedTx as `0x${string}`);
              broadcast = true;
              auditTrace.log("tx_broadcast", {
                intentId: intent.id,
                txHash: signed.txHash,
              });
            } catch (err) {
              broadcastError = err instanceof Error ? err.message : "Broadcast failed";
              auditTrace.log("broadcast_failed", {
                intentId: intent.id,
                txHash: signed.txHash,
                error: broadcastError,
              });
            }
          }

          const response: Record<string, unknown> = {
            signedTx: signed.signedTx,
            txHash: signed.txHash,
            intentId: intent.id,
            broadcast,
          };
          if (broadcastError !== undefined) {
            response["broadcastError"] = broadcastError;
          }

          return reply.code(200).send(response);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Signing failed";
          return reply.code(403).send({
            error: "signing_failed",
            message,
          });
        }
      },
    });

    // GET /v1/tx/:hash — Get transaction receipt
    app.get<{ Params: { hash: string } }>("/v1/tx/:hash", {
      schema: {
        params: {
          type: "object",
          required: ["hash"],
          properties: {
            hash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
          },
        },
      },
      handler: async (request, reply) => {
        if (!rpcClient) {
          return reply.code(502).send({
            error: "no_rpc_client",
            message: "Transaction receipt lookup requires an RPC client, which is not configured.",
          });
        }

        const hash = request.params.hash as `0x${string}`;
        const receipt = await rpcClient.getTransactionReceipt(hash);

        if (!receipt) {
          return reply.code(404).send({
            error: "not_found",
            message: "Transaction receipt not found. It may be pending or the hash is invalid.",
          });
        }

        return reply.code(200).send(receipt);
      },
    });
  };
}
