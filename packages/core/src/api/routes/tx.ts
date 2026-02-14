import type { FastifyInstance } from "fastify";
import { TxIntentSchema } from "@clavion/types/schemas";
import { buildFromIntent } from "../../tx/builders/index.js";
import type { OneInchClient } from "../../aggregator/oneinch-client.js";
import { evaluate } from "@clavion/policy";
import type {
  PolicyConfig,
  PolicyDecision,
  TxIntent,
  BuildPlan,
  ApprovalSummary,
  BalanceDiff,
} from "@clavion/types";
import type { PreflightService } from "@clavion/preflight";
import type { AuditTraceService } from "@clavion/audit";
import type { WalletService } from "@clavion/signer";
import type { ApprovalTokenManager } from "../../approval/approval-token-manager.js";
import type { ApprovalService } from "../../approval/approval-service.js";
import type { RpcClient } from "@clavion/types/rpc";
import { resolveRpc } from "../../rpc/resolve-rpc.js";

export interface TxRouteServices {
  policyConfig: PolicyConfig;
  preflightService: PreflightService | null;
  auditTrace: AuditTraceService;
  walletService: WalletService;
  approvalTokenManager: ApprovalTokenManager;
  approvalService: ApprovalService;
  rpcClient: RpcClient | null;
  oneInchClient?: OneInchClient;
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
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown action type: ${(_exhaustive as { type: string }).type}`);
    }
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

const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour

/** Evaluate policy with rate-limit context and record tick if not denied. */
function evaluatePolicy(
  intent: TxIntent,
  policyConfig: PolicyConfig,
  auditTrace: AuditTraceService,
  extra?: { riskScore?: number },
): PolicyDecision {
  const recentTxCount = auditTrace.countRecentTxByWallet(
    intent.wallet.address,
    RATE_LIMIT_WINDOW_MS,
  );
  const decision = evaluate(intent, policyConfig, {
    recentTxCount,
    ...extra,
  });
  if (decision.decision !== "deny") {
    auditTrace.recordRateLimitTick(intent.wallet.address);
  }
  return decision;
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
      oneInchClient,
    } = services;
    const builderDeps = { oneInchClient };

    // POST /v1/tx/build — Build transaction from TxIntent
    app.post("/v1/tx/build", {
      schema: {
        body: TxIntentSchema,
      },
      handler: async (request, reply) => {
        const intent = request.body as TxIntent;

        const decision = evaluatePolicy(intent, policyConfig, auditTrace);

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

        // Build the transaction
        const plan = await buildFromIntent(intent, builderDeps);

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

        const chainRpcForPreflight = resolveRpc(rpcClient, intent.chain.chainId);
        if (!preflightService || !chainRpcForPreflight) {
          return reply.code(502).send({
            error: "no_rpc_client",
            message: `PreflightService requires an RPC client for chain ${intent.chain.chainId}, which is not configured.`,
          });
        }

        const plan = await buildFromIntent(intent, builderDeps);
        const result = await preflightService.simulate(intent, plan, chainRpcForPreflight);

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
        const plan = await buildFromIntent(intent, builderDeps);

        // Run preflight if available (to get risk score)
        let riskScore = 0;
        let riskReasons: string[] = [];
        let warnings: string[] = [];
        let gasEstimate = "0";
        let balanceDiffs: BalanceDiff[] = [];

        const chainRpcForApproval = resolveRpc(rpcClient, intent.chain.chainId);
        if (preflightService && chainRpcForApproval) {
          const preflight = await preflightService.simulate(intent, plan, chainRpcForApproval);
          riskScore = preflight.riskScore;
          riskReasons = preflight.riskReasons;
          warnings = preflight.warnings;
          gasEstimate = preflight.gasEstimate;
          balanceDiffs = preflight.balanceDiffs;
        }

        // Policy check (with risk score from preflight)
        const decision = evaluatePolicy(intent, policyConfig, auditTrace, { riskScore });

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

        if (!approvalResult.token) {
          return reply.code(500).send({ error: "internal_error", message: "Approval token not issued" });
        }

        return reply.code(200).send({
          ...baseResponse,
          approvalRequired: true,
          approved: true,
          approvalTokenId: approvalResult.token.id,
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
        const plan = await buildFromIntent(intent, builderDeps);

        const decision = evaluatePolicy(intent, policyConfig, auditTrace);

        if (decision.decision === "deny") {
          return reply.code(403).send({
            error: "policy_denied",
            reasons: decision.reasons,
          });
        }

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
          const tokenCheck = approvalTokenManager.validate(approvalTokenId, intent.id, plan.txRequestHash);
          if (!tokenCheck.valid) {
            return reply.code(403).send({
              error: "invalid_approval_token",
              reason: tokenCheck.reason,
              message: `Approval token rejected: ${tokenCheck.reason ?? "unknown"}`,
            });
          }
          // Don't consume here — WalletService.sign() validates+consumes as defense-in-depth
          approvalToken = approvalTokenManager.get(approvalTokenId);
        }

        // Resolve chain-scoped RPC for nonce, gas, fees, and broadcast
        const chainRpc = resolveRpc(rpcClient, intent.chain.chainId);

        // Populate nonce and gas from RPC if available (required for broadcast)
        const txRequest = { ...plan.txRequest };
        if (chainRpc) {
          try {
            const [nonce, gasEstimate, fees] = await Promise.all([
              chainRpc.getTransactionCount(intent.wallet.address as `0x${string}`),
              chainRpc.estimateGas({
                to: plan.txRequest.to!,
                data: plan.txRequest.data!,
                from: intent.wallet.address as `0x${string}`,
                value: plan.txRequest.value ?? 0n,
              }),
              chainRpc.estimateFeesPerGas(),
            ]);
            txRequest.nonce = nonce;
            txRequest.gas = gasEstimate;
            txRequest.maxFeePerGas = fees.maxFeePerGas;
            txRequest.maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            request.log.warn({ err: msg }, "RPC gas/nonce estimation failed, using builder defaults");
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

          // Attempt broadcast if RPC client is available for this chain
          let broadcast = false;
          let broadcastError: string | undefined;

          if (chainRpc) {
            try {
              await chainRpc.sendRawTransaction(signed.signedTx as `0x${string}`);
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
