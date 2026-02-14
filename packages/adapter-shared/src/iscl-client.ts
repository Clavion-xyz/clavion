const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const DEFAULT_TIMEOUT_MS = 30_000;

export class ISCLError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`ISCL API error: ${status}`);
    this.name = "ISCLError";
  }
}

export interface ISCLClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

// Response types — adapter-domain definitions (not imported from core/types.ts)

export interface HealthResponse {
  status: "ok";
  version: string;
  uptime: number;
}

export interface BuildResponse {
  intentId: string;
  txRequestHash: string;
  description: string;
  txRequest: Record<string, unknown>;
  policyDecision: {
    decision: string;
    reasons: string[];
    policyVersion: string;
  };
}

export interface PreflightResponse {
  intentId: string;
  simulationSuccess: boolean;
  riskScore: number;
  gasEstimate: string;
  balanceDiffs: unknown[];
  allowanceChanges: unknown[];
  riskReasons: string[];
  warnings: string[];
  revertReason?: string;
}

export interface ApproveRequestResponse {
  intentId: string;
  txRequestHash: string;
  description: string;
  policyDecision: {
    decision: string;
    reasons: string[];
    policyVersion: string;
  };
  riskScore: number;
  riskReasons: string[];
  warnings: string[];
  gasEstimate: string;
  balanceDiffs: unknown[];
  approvalRequired: boolean;
  approved: boolean;
  approvalTokenId?: string;
  reason?: string;
}

export interface SignAndSendResponse {
  signedTx: string;
  txHash: string;
  intentId: string;
  broadcast: boolean;
  broadcastError?: string;
}

export interface BalanceResponse {
  token: string;
  account: string;
  balance: string;
}

export interface TxReceiptResponse {
  transactionHash: string;
  status: "success" | "reverted";
  blockNumber: string;
  blockHash: string;
  gasUsed: string;
  effectiveGasPrice: string;
  from: string;
  to: string | null;
  contractAddress: string | null;
}

// Web approval types

export interface ApprovalSummary {
  intentId: string;
  action: string;
  recipient?: string;
  spender?: string;
  expectedOutcome: string;
  balanceDiffs: Array<{
    asset: string;
    delta: string;
    usdValue?: string;
  }>;
  riskScore: number;
  riskReasons: string[];
  warnings: string[];
  gasEstimateEth: string;
}

export interface PendingApprovalItem {
  requestId: string;
  summary: ApprovalSummary;
  createdAt: number;
  expiresAt: number;
}

export interface PendingApprovalsResponse {
  pending: PendingApprovalItem[];
}

export interface DecideResponse {
  decided: boolean;
  requestId: string;
  approved: boolean;
}

export class ISCLClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: ISCLClientOptions) {
    this.baseUrl =
      options?.baseUrl ?? process.env["ISCL_API_URL"] ?? DEFAULT_BASE_URL;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/v1/health");
  }

  async txBuild(intent: unknown): Promise<BuildResponse> {
    return this.post<BuildResponse>("/v1/tx/build", intent);
  }

  async txPreflight(intent: unknown): Promise<PreflightResponse> {
    return this.post<PreflightResponse>("/v1/tx/preflight", intent);
  }

  async txApproveRequest(intent: unknown): Promise<ApproveRequestResponse> {
    return this.post<ApproveRequestResponse>(
      "/v1/tx/approve-request",
      intent,
    );
  }

  async txSignAndSend(payload: {
    intent: unknown;
    approvalTokenId?: string;
  }): Promise<SignAndSendResponse> {
    return this.post<SignAndSendResponse>("/v1/tx/sign-and-send", payload);
  }

  async balance(token: string, account: string, chainId?: number): Promise<BalanceResponse> {
    const query = chainId !== undefined ? `?chainId=${chainId}` : "";
    return this.get<BalanceResponse>(`/v1/balance/${token}/${account}${query}`);
  }

  async txReceipt(hash: string): Promise<TxReceiptResponse> {
    return this.get<TxReceiptResponse>(`/v1/tx/${hash}`);
  }

  async pendingApprovals(): Promise<PendingApprovalsResponse> {
    return this.get<PendingApprovalsResponse>("/v1/approvals/pending");
  }

  async submitDecision(requestId: string, approved: boolean): Promise<DecideResponse> {
    return this.post<DecideResponse>(
      `/v1/approvals/${requestId}/decide`,
      { approved },
    );
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });

      const body: unknown = await res.json();

      if (!res.ok) {
        throw new ISCLError(res.status, body);
      }

      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async post<T>(path: string, data: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      const body: unknown = await res.json();

      if (!res.ok) {
        throw new ISCLError(res.status, body);
      }

      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
