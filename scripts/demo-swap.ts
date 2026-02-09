/**
 * Demo: USDC → WETH swap on Base via ISCL (Uniswap V3)
 *
 * Usage:
 *   npx tsx scripts/demo-swap.ts
 *
 * Requires ISCL Core running at http://127.0.0.1:3100
 */

import { ISCLClient, ISCLError } from "../adapter/shared/iscl-client.js";
import { buildIntent } from "../adapter/skills/intent-builder.js";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
const UNISWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";

async function main(): Promise<void> {
  const client = new ISCLClient();

  console.log("=== ISCL Swap Demo (USDC → WETH) ===\n");

  // 1. Health check
  console.log("1. Checking ISCL Core health...");
  const health = await client.health();
  console.log(`   Status: ${health.status}, Version: ${health.version}\n`);

  // 2. Build swap intent
  console.log("2. Building swap intent...");
  const intent = buildIntent({
    walletAddress: WALLET,
    action: {
      type: "swap_exact_in" as const,
      router: UNISWAP_ROUTER,
      assetIn: { kind: "erc20" as const, address: USDC, symbol: "USDC", decimals: 6 },
      assetOut: { kind: "erc20" as const, address: WETH, symbol: "WETH", decimals: 18 },
      amountIn: "10000000",
      minAmountOut: "4000000000000000",
    },
    slippageBps: 100,
  });
  console.log(`   Intent ID: ${intent.id}`);
  console.log(`   Action: Swap 10 USDC → WETH via Uniswap V3`);
  console.log(`   Min output: 0.004 WETH\n`);

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
      return;
    }
    throw err;
  }

  // 4. Preflight
  console.log("4. POST /v1/tx/preflight...");
  try {
    const preflight = await client.txPreflight(intent);
    console.log(`   Simulation: ${preflight.simulationSuccess ? "SUCCESS" : "FAILED"}`);
    console.log(`   Gas estimate: ${preflight.gasEstimate}`);
    console.log(`   Risk score: ${preflight.riskScore}`);
    if (preflight.riskReasons.length > 0) {
      console.log(`   Risk reasons: ${preflight.riskReasons.join(", ")}`);
    }
    if (preflight.warnings.length > 0) {
      console.log(`   Warnings: ${preflight.warnings.join(", ")}`);
    }
    console.log();
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

  // 6. Sign
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
