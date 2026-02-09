// Shim: re-exports from @clavion/adapter-openclaw for backward compatibility during migration
export { ISCLClient, ISCLError } from "@clavion/adapter-openclaw";
export type {
  ISCLClientOptions,
  HealthResponse,
  BuildResponse,
  PreflightResponse,
  ApproveRequestResponse,
  SignAndSendResponse,
  BalanceResponse,
  TxReceiptResponse,
} from "@clavion/adapter-openclaw";
export {
  handleTransfer,
  handleTransferNative,
  handleApprove,
  handleSwap,
  handleBalance,
  buildIntent,
} from "@clavion/adapter-openclaw";
export type {
  IntentBuilderOptions,
  AssetParam,
  BaseSkillParams,
  TransferParams,
  TransferNativeParams,
  ApproveParams,
  SwapParams,
  BalanceParams,
  SkillResult,
} from "@clavion/adapter-openclaw";
export { verifyInstallation } from "@clavion/adapter-openclaw";
export { openclawTools, executeOpenClawTool } from "@clavion/adapter-openclaw";
export type { ToolDefinition } from "@clavion/adapter-openclaw";
