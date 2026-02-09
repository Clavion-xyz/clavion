// Shim: re-exports from @clavion/adapter-openclaw for backward compatibility during migration
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
