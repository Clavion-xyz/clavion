/**
 * Demo: USDC transfer on Base via ISCL
 *
 * Usage:
 *   npx tsx scripts/demo-transfer.ts
 *
 * Requires ISCL Core running at http://127.0.0.1:3100
 */

import { ISCLClient, ISCLError } from "../adapter/shared/iscl-client.js";
import { buildIntent } from "../adapter/skills/intent-builder.js";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const RECIPIENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main(): Promise<void> {
  const client = new ISCLClient();

  console.log("=== ISCL Transfer Demo ===\n");

  // 1. Health check
  console.log("1. Checking ISCL Core health...");
  const health = await client.health();
  console.log(`   Status: ${health.status}, Version: ${health.version}\n`);

  // 2. Build intent
  console.log("2. Building transfer intent...");
  const intent = buildIntent({
    walletAddress: WALLET,
    action: {
      type: "transfer" as const,
      asset: { kind: "erc20" as const, address: USDC, symbol: "USDC", decimals: 6 },
      to: RECIPIENT,
      amount: "1000000",
    },
  });
  console.log(`   Intent ID: ${intent.id}`);
  console.log(`   Action: Transfer 1 USDC to ${RECIPIENT}\n`);

  // 3. Build transaction
  console.log("3. POST /v1/tx/build...");
  try {
    const build = await client.txBuild(intent);
    console.log(`   Description: ${build.description}`);
    console.log(`   TX Hash: ${build.txRequestHash}`);
    console.log(`   Policy: ${build.policyDecision.decision}\n`);
  } catch (err) {
    if (err instanceof ISCLError) {
      console.log(`   Policy denied: ${JSON.stringify(err.body)}\n`);
    } else {
      throw err;
    }
  }

  // 4. Preflight
  console.log("4. POST /v1/tx/preflight...");
  try {
    const preflight = await client.txPreflight(intent);
    console.log(`   Simulation: ${preflight.simulationSuccess ? "SUCCESS" : "FAILED"}`);
    console.log(`   Gas estimate: ${preflight.gasEstimate}`);
    console.log(`   Risk score: ${preflight.riskScore}\n`);
  } catch (err) {
    if (err instanceof ISCLError && (err.body as { error: string }).error === "no_rpc_client") {
      console.log("   Skipped (no RPC client configured)\n");
    } else {
      throw err;
    }
  }

  // 5. Approve request
  console.log("5. POST /v1/tx/approve-request...");
  try {
    const approval = await client.txApproveRequest(intent);
    console.log(`   Decision: ${approval.policyDecision.decision}`);
    console.log(`   Risk score: ${approval.riskScore}\n`);
  } catch (err) {
    if (err instanceof ISCLError) {
      console.log(`   Error: ${JSON.stringify(err.body)}\n`);
    } else {
      throw err;
    }
  }

  // 6. Sign (will fail without unlocked key — expected in demo)
  console.log("6. POST /v1/tx/sign-and-send...");
  try {
    const signed = await client.txSignAndSend({ intent });
    console.log(`   Signed TX: ${signed.signedTx.slice(0, 20)}...`);
    console.log(`   TX Hash: ${signed.txHash}\n`);
  } catch (err) {
    if (err instanceof ISCLError) {
      console.log(`   Expected error (no unlocked key): ${(err.body as { error: string }).error}\n`);
    } else {
      throw err;
    }
  }

  console.log("=== Demo Complete ===");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
