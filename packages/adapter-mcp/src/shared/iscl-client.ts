// Re-export from @clavion/adapter-shared — single source of truth
export {
  ISCLClient,
  ISCLError,
} from "@clavion/adapter-shared";

export type {
  ISCLClientOptions,
  HealthResponse,
  BuildResponse,
  PreflightResponse,
  ApproveRequestResponse,
  SignAndSendResponse,
  BalanceResponse,
  TxReceiptResponse,
  ApprovalSummary,
  PendingApprovalItem,
  PendingApprovalsResponse,
  DecideResponse,
} from "@clavion/adapter-shared";
