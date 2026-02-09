import { createRequire } from "node:module";
import { join } from "node:path";
import { homedir } from "node:os";
import Fastify, { type FastifyInstance } from "fastify";
import { Ajv } from "ajv";
import { healthRoute } from "./routes/health.js";
import { createTxRoutes } from "./routes/tx.js";
import { createBalanceRoutes } from "./routes/balance.js";
import { createSkillRoutes } from "./routes/skills.js";
import { AuditTraceService } from "../audit/audit-trace-service.js";
import { SkillRegistryService } from "../skill/skill-registry-service.js";
import { ApprovalTokenManager } from "../approval/approval-token-manager.js";
import { EncryptedKeystore } from "../wallet/keystore.js";
import { WalletService } from "../wallet/wallet-service.js";
import { ApprovalService } from "../approval/approval-service.js";
import { loadPolicyConfig, getDefaultConfig } from "../policy/policy-config.js";
import { PreflightService } from "../preflight/preflight-service.js";
import type { PolicyConfig } from "../types.js";
import type { RpcClient } from "../rpc/rpc-client.js";
import type { PromptFn } from "../approval/approval-service.js";

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
  skillRegistryDbPath?: string;
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

  // Encrypted keystore
  const keystorePath = options.keystorePath ?? join(homedir(), ".iscl", "keystore");
  const keystore = new EncryptedKeystore(keystorePath);
  app.decorate("keystore", keystore);

  // Wallet service (signing pipeline)
  const walletService = new WalletService(keystore, approvalTokenManager, auditTrace);
  app.decorate("walletService", walletService);

  // Approval service (with optional injectable prompt for testing)
  const approvalService = new ApprovalService(approvalTokenManager, auditTrace, options.promptFn);
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

  // Add version header to all responses
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-ISCL-Version", "0.1.0");
    return payload;
  });

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

  // Graceful shutdown
  app.addHook("onClose", async () => {
    skillRegistry.close();
    approvalTokenManager.close();
    auditTrace.close();
  });

  return app;
}
