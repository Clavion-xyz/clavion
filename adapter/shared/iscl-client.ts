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
