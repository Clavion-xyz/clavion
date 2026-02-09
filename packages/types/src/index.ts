import type { TransactionSerializableEIP1559 } from "viem";

// ---- Chain & Wallet ----

export interface ChainObject {
  type: "evm";
  chainId: number;
  rpcHint?: string;
}

export interface WalletObject {
  address: string;
  profile?: string;
}

// ---- Assets ----

export interface Asset {
  kind: "erc20";
  address: string;
  symbol?: string;
  decimals?: number;
}

// ---- Action Types ----

export interface TransferAction {
  type: "transfer";
  asset: Asset;
  to: string;
  amount: string;
}

export interface ApproveAction {
  type: "approve";
  asset: Asset;
  spender: string;
  amount: string;
}

export interface SwapExactInAction {
  type: "swap_exact_in";
  router: string;
  assetIn: Asset;
  assetOut: Asset;
  amountIn: string;
  minAmountOut: string;
}

export interface SwapExactOutAction {
  type: "swap_exact_out";
  router: string;
  assetIn: Asset;
  assetOut: Asset;
  amountOut: string;
  maxAmountIn: string;
}

export interface TransferNativeAction {
  type: "transfer_native";
  to: string;
  amount: string;
}

export type ActionObject =
  | TransferAction
  | ApproveAction
  | SwapExactInAction
  | SwapExactOutAction
  | TransferNativeAction;

// ---- Constraints, Preferences, Metadata ----

export interface Constraints {
  maxGasWei: string;
  deadline: number;
  maxSlippageBps: number;
}

export interface Preferences {
  speed?: "slow" | "normal" | "fast";
  privateRelay?: boolean;
}

export interface Metadata {
  source?: string;
  note?: string;
  [key: string]: unknown;
}

// ---- TxIntent ----

export interface TxIntent {
  version: "1";
  id: string;
  timestamp: number;
  chain: ChainObject;
  wallet: WalletObject;
  action: ActionObject;
  constraints: Constraints;
  preferences?: Preferences;
  metadata?: Metadata;
}

// ---- Policy ----

export interface PolicyDecision {
  decision: "allow" | "deny" | "require_approval";
  reasons: string[];
  policyVersion: string;
}

// ---- Audit ----

export interface AuditEvent {
  id: string;
  timestamp: number;
  intentId: string;
  event: string;
  data: Record<string, unknown>;
}

// ---- Approval Tokens ----

export interface ApprovalToken {
  id: string;
  intentId: string;
  txRequestHash: string;
  issuedAt: number;
  ttlSeconds: number;
  consumed: boolean;
}

/** Interface for validating/consuming approval tokens. Decouples @clavion/signer from @clavion/core. */
export interface ApprovalTokenVerifier {
  validate(tokenId: string, intentId: string, txRequestHash: string): boolean;
  consume(tokenId: string): void;
}

// ---- Wallet ----

export interface EncryptedKey {
  address: string;
  profile: string;
  cipher: "aes-256-gcm";
  kdf: "scrypt";
  kdfParams: {
    n: number;
    r: number;
    p: number;
    salt: string;
  };
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface SignRequest {
  intentId: string;
  walletAddress: string;
  txRequest: TransactionSerializableEIP1559;
  txRequestHash: string;
  policyDecision: PolicyDecision;
  approvalToken?: ApprovalToken;
}

export interface SignedTransaction {
  signedTx: `0x${string}`;
  txHash: `0x${string}`;
}

// ---- Approval Flow ----

export interface BalanceDiff {
  asset: string;
  delta: string;
  usdValue?: string;
  before?: string;
  after?: string;
}

export interface ApprovalSummary {
  intentId: string;
  action: string;
  recipient?: string;
  spender?: string;
  expectedOutcome: string;
  balanceDiffs: BalanceDiff[];
  riskScore: number;
  riskReasons: string[];
  warnings: string[];
  gasEstimateEth: string;
  txRequestHash: string;
}

export interface ApprovalResult {
  approved: boolean;
  token?: ApprovalToken;
}

// ---- Build Plan ----

export interface BuildPlan {
  intentId: string;
  txRequest: TransactionSerializableEIP1559;
  txRequestHash: string;
  description: string;
}

// ---- Policy Config ----

export interface PolicyConfig {
  version: "1";
  maxValueWei: string;
  maxApprovalAmount: string;
  contractAllowlist: string[];
  tokenAllowlist: string[];
  allowedChains: number[];
  recipientAllowlist: string[];
  maxRiskScore: number;
  requireApprovalAbove: { valueWei: string };
  maxTxPerHour: number;
}

// ---- Preflight ----

export interface PreflightResult {
  intentId: string;
  simulationSuccess: boolean;
  revertReason?: string;
  gasEstimate: string;
  balanceDiffs: BalanceDiff[];
  allowanceChanges: AllowanceChange[];
  riskScore: number;
  riskReasons: string[];
  warnings: string[];
}

export interface AllowanceChange {
  token: string;
  spender: string;
  before: string;
  after: string;
}

// ---- Risk Context ----

export interface RiskContext {
  contractInAllowlist: boolean;
  tokenInAllowlist: boolean;
  slippageBps: number;
  simulationReverted: boolean;
  gasEstimate: bigint;
  approvalAmount?: bigint;
  maxApprovalAmount?: bigint;
  valueWei?: bigint;
  maxValueWei?: bigint;
}

// ---- Skill Manifest ----

export interface SkillManifest {
  version: "1";
  name: string;
  publisher: {
    name: string;
    address: string;
    contact: string;
  };
  permissions: {
    txActions: Array<"transfer" | "approve" | "swap_exact_in" | "swap_exact_out" | "transfer_native">;
    chains: number[];
    networkAccess: boolean;
    filesystemAccess: boolean;
  };
  sandbox: {
    memoryMb: number;
    timeoutMs: number;
    allowSpawn: boolean;
  };
  files: Array<{
    path: string;
    sha256: string;
  }>;
  signature: string;
}

// ---- Sandbox ----

export interface SandboxConfig {
  image: string;
  networkMode: "none" | "allowlist";
  allowedHosts?: string[];
  readOnlyRootfs: boolean;
  memoryLimitMb: number;
  cpuQuota: number;
  timeoutMs: number;
  noSpawn: boolean;
  env: Record<string, string>;
}

export interface SkillInput {
  skillName: string;
  manifest: SkillManifest;
  apiUrl: string;
}

export interface SkillOutput {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

// ---- Static Scanner ----

export interface ScanFinding {
  file: string;
  line: number;
  rule: string;
  severity: "error" | "warning";
  message: string;
}

export interface ScanReport {
  passed: boolean;
  findings: ScanFinding[];
}

// ---- Skill Registry ----

export interface RegisteredSkill {
  name: string;
  publisherAddress: string;
  publisherName: string;
  manifest: SkillManifest;
  manifestHash: string;
  status: "active" | "revoked";
  registeredAt: number;
  revokedAt: number | null;
}

export interface RegistrationResult {
  registered: boolean;
  name: string;
  manifestHash: string;
  error?: string;
  scanFindings?: ScanFinding[];
  validationErrors?: Array<{ path: string; message: string }>;
  hashMismatches?: string[];
}
