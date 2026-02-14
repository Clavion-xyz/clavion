// API
export { buildApp } from "./api/app.js";
export type { AppOptions } from "./api/app.js";
export { healthRoute } from "./api/routes/health.js";
export { createTxRoutes } from "./api/routes/tx.js";
export type { TxRouteServices } from "./api/routes/tx.js";
export { createBalanceRoutes } from "./api/routes/balance.js";
export type { BalanceRouteServices } from "./api/routes/balance.js";
export { createSkillRoutes } from "./api/routes/skills.js";
export type { SkillRouteServices } from "./api/routes/skills.js";

// RPC
export { ViemRpcClient } from "./rpc/viem-rpc-client.js";
export { RpcRouter } from "./rpc/rpc-router.js";
export { resolveRpc } from "./rpc/resolve-rpc.js";
export { parseRpcEnv } from "./rpc/parse-rpc-env.js";

// Transaction builders
export {
  buildFromIntent,
  buildTransfer,
  buildTransferNative,
  buildApprove,
  buildSwap,
  buildSwapOneInch,
  computeTxRequestHash,
  UNISWAP_V3_ROUTERS,
  UNISWAP_V3_SWAP_ROUTER_BASE,
  DEFAULT_FEE_TIER,
  ONEINCH_ROUTERS,
  ONEINCH_NATIVE_TOKEN,
  ONEINCH_SUPPORTED_CHAINS,
  OneInchClient,
  OneInchApiError,
} from "./tx/index.js";
export type { BuilderDeps, OneInchClientOptions } from "./tx/index.js";

// Canonicalization
export { computeIntentHash } from "./canonicalize/intent-hash.js";

// Schema validation
export { validateTxIntent } from "./schemas/validator.js";
export type { ValidationResult } from "./schemas/validator.js";

// Approval
export { ApprovalTokenManager } from "./approval/approval-token-manager.js";
export type { TokenValidationResult, TokenValidationReason } from "./approval/approval-token-manager.js";
export { ApprovalService } from "./approval/approval-service.js";
export type { PromptFn } from "./approval/approval-service.js";
export { PendingApprovalStore } from "./approval/pending-approval-store.js";
export type { PendingApproval } from "./approval/pending-approval-store.js";

// Approval UI routes
export { createApprovalUIRoutes } from "./api/routes/approval-ui.js";
export type { ApprovalUIRouteServices } from "./api/routes/approval-ui.js";
