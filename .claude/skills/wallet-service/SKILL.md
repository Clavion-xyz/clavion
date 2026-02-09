---
name: wallet-service
description: >
  ISCL WalletService — encrypted keystore, key isolation, and signing pipeline. Use when
  working on key management, the signing flow, keystore encryption/decryption, approval
  token enforcement, or anything touching private key material. Triggers: WalletService,
  keystore, signing, private key, encryption, unlock, approval token, EOA wallet.
---

# Wallet Service

WalletService is the **only** component that touches private keys. It lives exclusively in
Domain B. No other service, module, or API endpoint may access key material directly.

## Responsibilities

- Encrypted keystore (persist keys at rest)
- Key loading into memory after unlock
- Transaction signing (single entrypoint)
- Approval token enforcement before signing
- Key isolation enforcement (never expose to Domain A or C)

## Keystore Design

```
~/.iscl/keystore/
├── default.enc     # encrypted key file
└── keystore.json   # metadata (addresses, profiles, no secrets)
```

Encryption: scrypt (or argon2) key derivation + AES-256-GCM

```typescript
interface EncryptedKey {
  address: string;
  profile: string;
  cipher: "aes-256-gcm";
  kdf: "scrypt";
  kdfParams: { n: number; r: number; p: number; salt: string };
  ciphertext: string;  // hex
  iv: string;          // hex
  mac: string;         // hex
}
```

## Signing Pipeline — Single Path

```typescript
class WalletService {
  async sign(request: SignRequest): Promise<SignedTransaction> {
    // 1. Verify PolicyDecision is "allow" or "require_approval" (already approved)
    this.requirePolicyDecision(request.policyDecision);

    // 2. Verify ApprovalToken (if approval mode enabled)
    this.requireApprovalToken(request.approvalToken, request.txRequestHash);

    // 3. Consume approval token (single-use)
    await this.approvalTokenManager.consume(request.approvalToken);

    // 4. Load key (must be unlocked)
    const key = this.getUnlockedKey(request.walletAddress);

    // 5. Sign transaction
    const signed = await signTransaction(key, request.txRequest);

    // 6. Audit log
    this.auditTrace.log("signature_created", {
      intentId: request.intentId,
      txRequestHash: request.txRequestHash,
      signerId: request.walletAddress,
    });

    return signed;
  }
}
```

## Critical Rules

1. **No `signRaw` endpoint** — only typed TxIntent-derived transactions are signed
2. **No signing without PolicyDecision** — WalletService checks this, throws if missing
3. **No signing without ApprovalToken** (when approval mode on) — single-use, TTL-bound
4. **Keys never in API responses** — never serialized, never logged, never returned
5. **Keys never in env vars** — loaded from encrypted keystore only after unlock
6. **Unlock requires user passphrase** — no auto-unlock without interaction

## Approval Token

```typescript
interface ApprovalToken {
  id: string;           // UUID
  intentId: string;     // bound to specific intent
  txRequestHash: string; // bound to specific built tx
  issuedAt: number;     // unix timestamp
  ttlSeconds: number;   // expiration window
  consumed: boolean;    // single-use flag
}
```

Reject if: expired, already consumed, intentId mismatch, txRequestHash mismatch.

## Security Tests to Maintain

- `SecurityTest_B2`: Attempt signing without approval → 403
- `SecurityTest_B3`: Reuse approval token → refusal
- `SecurityTest_A1`: Evil skill attempts to read keystore paths → keys absent
- `SecurityTest_C1`: Sandbox code attempts key access → keys absent
