import { keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { EncryptedKeystore } from "./keystore.js";
import type { ApprovalTokenManager } from "../approval/approval-token-manager.js";
import type { AuditTraceService } from "../audit/audit-trace-service.js";
import type { SignRequest, SignedTransaction } from "../types.js";

export class WalletService {
  constructor(
    private keystore: EncryptedKeystore,
    private approvalTokenManager: ApprovalTokenManager,
    private auditTrace: AuditTraceService,
  ) {}

  async sign(request: SignRequest): Promise<SignedTransaction> {
    const { intentId, walletAddress, txRequest, txRequestHash, policyDecision, approvalToken } =
      request;

    // 1. PolicyDecision must exist
    if (!policyDecision) {
      this.auditTrace.log("signing_denied", {
        intentId,
        reason: "missing_policy_decision",
      });
      throw new Error("PolicyDecision is required for signing");
    }

    // 2. Deny policy → reject
    if (policyDecision.decision === "deny") {
      this.auditTrace.log("signing_denied", {
        intentId,
        reason: "policy_deny",
        policyReasons: policyDecision.reasons,
      });
      throw new Error(`Signing denied by policy: ${policyDecision.reasons.join(", ")}`);
    }

    // 3. require_approval → validate + consume approval token
    if (policyDecision.decision === "require_approval") {
      if (!approvalToken) {
        this.auditTrace.log("signing_denied", {
          intentId,
          reason: "missing_approval_token",
        });
        throw new Error("ApprovalToken is required when policy decision is require_approval");
      }

      const isValid = this.approvalTokenManager.validate(
        approvalToken.id,
        intentId,
        txRequestHash,
      );

      if (!isValid) {
        this.auditTrace.log("signing_denied", {
          intentId,
          reason: "invalid_approval_token",
          tokenId: approvalToken.id,
        });
        throw new Error("ApprovalToken is invalid, expired, or already consumed");
      }

      // Consume token — single use
      this.approvalTokenManager.consume(approvalToken.id);
    }

    // 4. Get unlocked key from keystore
    let privateKey: `0x${string}`;
    try {
      privateKey = this.keystore.getUnlockedKey(walletAddress);
    } catch {
      this.auditTrace.log("signing_denied", {
        intentId,
        reason: "key_locked",
        address: walletAddress,
      });
      throw new Error(`Key for address ${walletAddress} is not unlocked`);
    }

    // 5. Sign transaction with viem
    const account = privateKeyToAccount(privateKey);
    const signedTx = await account.signTransaction(txRequest);

    // 6. Compute tx hash
    const txHash = keccak256(signedTx);

    // 7. Audit log success
    this.auditTrace.log("signature_created", {
      intentId,
      txRequestHash,
      signerAddress: walletAddress,
      txHash,
    });

    return { signedTx, txHash };
  }
}
