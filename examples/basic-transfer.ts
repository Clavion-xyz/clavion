/**
 * Example: Basic ERC-20 transfer via ISCL
 *
 * Demonstrates the full secure pipeline:
 *   1. Build transaction (validates intent, checks policy)
 *   2. Request approval (prompts user, issues single-use token)
 *   3. Sign and send (signs with isolated key, broadcasts to chain)
 *
 * Prerequisites:
 *   1. ISCL Core running on http://localhost:3100
 *   2. Wallet imported and unlocked (clavion-cli key import)
 *   3. RPC configured (BASE_RPC_URL or ISCL_RPC_URL_8453)
 *
 * Usage:
 *   npx tsx examples/basic-transfer.ts
 */

const ISCL_URL = process.env["ISCL_API_URL"] ?? "http://localhost:3100";

// Build a TxIntent — the standard format for all Clavion operations.
// The agent only expresses *what* it wants to do; Clavion handles *how*.
const intent = {
  version: "1",
  id: crypto.randomUUID(),
  timestamp: Math.floor(Date.now() / 1000),
  chain: {
    type: "evm" as const,
    chainId: 8453, // Base
  },
  wallet: {
    address: "0xYOUR_WALLET_ADDRESS", // Replace with your keystore address
  },
  action: {
    type: "transfer" as const,
    asset: {
      kind: "erc20" as const,
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      symbol: "USDC",
      decimals: 6,
    },
    to: "0xRECIPIENT_ADDRESS", // Replace with recipient
    amount: "1000000", // 1 USDC (6 decimals)
  },
  constraints: {
    maxGasWei: "1000000000000000",
    deadline: Math.floor(Date.now() / 1000) + 600, // 10 minutes
    maxSlippageBps: 0, // No slippage for transfers
  },
};

async function main(): Promise<void> {
  // Step 1: Build and validate
  // Policy engine checks: chain allowlist, value limits, contract allowlist, rate limits
  console.log("Step 1: Building transaction...");
  const buildRes = await fetch(`${ISCL_URL}/v1/tx/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(intent),
  });
  const buildData = await buildRes.json();

  if (!buildRes.ok) {
    console.error("Build failed:", JSON.stringify(buildData, null, 2));
    return;
  }
  console.log("  Description:", buildData.description);
  console.log("  Policy:", buildData.policyDecision.decision);

  // Step 2: Request approval
  // If policy says "require_approval", the user is prompted (CLI or web UI).
  // Returns a single-use approvalTokenId valid for 5 minutes.
  console.log("\nStep 2: Requesting approval...");
  const approveRes = await fetch(`${ISCL_URL}/v1/tx/approve-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(intent),
  });
  const approveData = await approveRes.json();

  if (!approveRes.ok || approveData.approved === false) {
    console.error("Approval denied:", approveData.reason ?? "policy_denied");
    return;
  }
  console.log("  Approved:", approveData.approved);
  console.log("  Risk score:", approveData.riskScore ?? "n/a");

  // Step 3: Sign and broadcast
  // Uses the approval token to authorize signing. Private key never leaves Domain B.
  console.log("\nStep 3: Signing and broadcasting...");
  const signRes = await fetch(`${ISCL_URL}/v1/tx/sign-and-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent,
      approvalTokenId: approveData.approvalTokenId,
    }),
  });
  const signData = await signRes.json();

  if (!signRes.ok) {
    console.error("Sign failed:", JSON.stringify(signData, null, 2));
    return;
  }
  console.log("  TX hash:", signData.txHash);
  console.log("  Broadcast:", signData.broadcast);
  if (signData.broadcastError) {
    console.warn("  Broadcast error:", signData.broadcastError);
  }
}

main().catch(console.error);
