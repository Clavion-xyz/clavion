import { createRequire } from "node:module";
import { join } from "node:path";
import { homedir } from "node:os";
import Fastify, { type FastifyInstance } from "fastify";
import { Ajv } from "ajv";
import { healthRoute } from "./routes/health.js";
import { createTxRoutes } from "./routes/tx.js";
import { createBalanceRoutes } from "./routes/balance.js";
import { createSkillRoutes } from "./routes/skills.js";
import { createApprovalUIRoutes } from "./routes/approval-ui.js";
import { AuditTraceService } from "@clavion/audit";
import { PendingApprovalStore } from "../approval/pending-approval-store.js";
import { SkillRegistryService } from "@clavion/registry";
import { ApprovalTokenManager } from "../approval/approval-token-manager.js";
import { EncryptedKeystore } from "@clavion/signer";
import { WalletService } from "@clavion/signer";
import { ApprovalService } from "../approval/approval-service.js";
import { loadPolicyConfig, getDefaultConfig } from "@clavion/policy";
import { PreflightService } from "@clavion/preflight";
import type { PolicyConfig } from "@clavion/types";
import type { RpcClient } from "@clavion/types/rpc";
import type { PromptFn } from "../approval/approval-service.js";
import { OneInchClient } from "../aggregator/oneinch-client.js";

const require = createRequire(import.meta.url);
const addFormats = require("ajv-formats") as (ajv: Ajv) => void;

export interface AppOptions {
  logger?: boolean;
  auditDbPath?: string;
  keystorePath?: string;
  policyConfigPath?: string;
  policyConfig?: PolicyConfig;
  rpcClient?: RpcClient;
  promptFn?: PromptFn;
  approvalMode?: "cli" | "web" | "auto";
  skillRegistryDbPath?: string;
  oneInchApiKey?: string;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger !== false ? { level: "info" } : false,
  });

  // Custom AJV instance with strict mode + format support (uuid)
  const customAjv = new Ajv({ strict: true, allErrors: true });
  addFormats(customAjv);
  app.setValidatorCompiler(({ schema }) => {
    return customAjv.compile(schema);
  });

  // Decorate with shared services
  const auditDbPath = options.auditDbPath ?? "./iscl-audit.sqlite";
  const auditTrace = new AuditTraceService(auditDbPath);
  app.decorate("auditTrace", auditTrace);

  // Approval token manager (own DB connection, same path)
  const approvalTokenManager = new ApprovalTokenManager(auditDbPath);
  app.decorate("approvalTokenManager", approvalTokenManager);

  // Periodic cleanup of expired approval tokens (every 60s)
  const tokenCleanupInterval = setInterval(() => approvalTokenManager.cleanup(), 60_000);
  tokenCleanupInterval.unref();

  // Encrypted keystore
  const keystorePath = options.keystorePath ?? join(homedir(), ".iscl", "keystore");
  const keystore = new EncryptedKeystore(keystorePath);
  app.decorate("keystore", keystore);

  // Wallet service (signing pipeline)
  const walletService = new WalletService(keystore, approvalTokenManager, auditTrace);
  app.decorate("walletService", walletService);

  // Approval service — resolve prompt function based on mode
  let pendingStore: PendingApprovalStore | null = null;
  let resolvedPromptFn = options.promptFn;

  if (!resolvedPromptFn && options.approvalMode === "web") {
    pendingStore = new PendingApprovalStore();
    resolvedPromptFn = async (summary) => pendingStore!.add(summary);
  } else if (!resolvedPromptFn && options.approvalMode === "auto") {
    resolvedPromptFn = async () => true;
  }

  const approvalService = new ApprovalService(approvalTokenManager, auditTrace, resolvedPromptFn);
  app.decorate("approvalService", approvalService);

  // Policy config
  const policyConfig =
    options.policyConfig ??
    (options.policyConfigPath
      ? loadPolicyConfig(options.policyConfigPath)
      : getDefaultConfig());

  // Preflight service (requires RPC client)
  const preflightService = options.rpcClient
    ? new PreflightService(options.rpcClient, policyConfig)
    : null;

  // CORS headers
  app.addHook("onRequest", async (request, reply) => {
    const origin = process.env.ISCL_CORS_ORIGIN ?? "http://localhost:3100";
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  // Add version header to all responses
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-ISCL-Version", "0.1.0");
    return payload;
  });

  // 1inch aggregator client (optional — requires API key)
  const oneInchClient = options.oneInchApiKey
    ? new OneInchClient({ apiKey: options.oneInchApiKey })
    : undefined;

  // Register routes
  await app.register(healthRoute);
  await app.register(
    createTxRoutes({
      policyConfig,
      preflightService,
      auditTrace,
      walletService,
      approvalTokenManager,
      approvalService,
      rpcClient: options.rpcClient ?? null,
      oneInchClient,
    }),
  );

  await app.register(
    createBalanceRoutes({
      rpcClient: options.rpcClient ?? null,
    }),
  );

  // Skill registry
  const skillRegistryDbPath = options.skillRegistryDbPath ?? auditDbPath;
  const skillRegistry = new SkillRegistryService(skillRegistryDbPath);
  await app.register(
    createSkillRoutes({
      registry: skillRegistry,
      auditTrace,
    }),
  );

  // Web approval UI (only when approvalMode is "web")
  if (pendingStore) {
    await app.register(
      createApprovalUIRoutes({
        pendingStore,
        auditTrace,
      }),
    );
  }

  // Graceful shutdown
  app.addHook("onClose", async () => {
    clearInterval(tokenCleanupInterval);
    if (pendingStore) pendingStore.close();
    skillRegistry.close();
    approvalTokenManager.close();
    auditTrace.close();
  });

  return app;
}
