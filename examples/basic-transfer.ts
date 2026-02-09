/**
 * Example: Basic ERC-20 transfer via ISCL
 *
 * Prerequisites:
 *   1. ISCL Core running on http://localhost:3100
 *   2. Wallet imported and unlocked
 *
 * Usage:
 *   npx tsx examples/basic-transfer.ts
 */

const ISCL_URL = process.env["ISCL_API_URL"] ?? "http://localhost:3100";

const intent = {
  version: "1",
  id: crypto.randomUUID(),
  timestamp: Math.floor(Date.now() / 1000),
  chain: {
    type: "evm" as const,
    chainId: 8453,
    rpcHint: "https://mainnet.base.org",
  },
  wallet: {
    address: "0xYOUR_WALLET_ADDRESS",
    profile: "default",
  },
  action: {
    type: "transfer" as const,
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    to: "0xRECIPIENT_ADDRESS",
    amount: "1000000", // 1 USDC (6 decimals)
  },
  constraints: {
    maxGasWei: "1000000000000000",
    deadline: Math.floor(Date.now() / 1000) + 600,
    maxSlippageBps: 100,
  },
  preferences: {},
  metadata: {
    source: "example-script",
    note: "Basic transfer example",
  },
};

async function main(): Promise<void> {
  // Step 1: Build and validate
  console.log("Building transaction...");
  const buildRes = await fetch(`${ISCL_URL}/v1/tx/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent }),
  });
  const buildData = await buildRes.json();
  console.log("Build result:", JSON.stringify(buildData, null, 2));

  if (!buildRes.ok) {
    console.error("Build failed:", buildData);
    return;
  }

  // Step 2: Request approval
  console.log("\nRequesting approval...");
  const approveRes = await fetch(`${ISCL_URL}/v1/tx/approve-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent }),
  });
  const approveData = await approveRes.json();
  console.log("Approval result:", JSON.stringify(approveData, null, 2));

  if (!approveRes.ok || !approveData.approvalToken) {
    console.error("Approval denied or failed");
    return;
  }

  // Step 3: Sign and send
  console.log("\nSigning and sending...");
  const signRes = await fetch(`${ISCL_URL}/v1/tx/sign-and-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent,
      approvalToken: approveData.approvalToken,
    }),
  });
  const signData = await signRes.json();
  console.log("Sign result:", JSON.stringify(signData, null, 2));
}

main().catch(console.error);
