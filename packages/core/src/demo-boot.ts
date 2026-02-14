/**
 * Demo boot script — unlocks test wallet and starts ISCL Core
 * with auto-approve enabled for the demo environment.
 *
 * Environment:
 *   ISCL_DEMO_PASSPHRASE — passphrase for test keystore (default: "test-passphrase-123")
 *   ISCL_AUTO_APPROVE    — "true" to auto-approve all transactions (default: false)
 *   BASE_RPC_URL         — Anvil fork URL (legacy, maps to chain 8453)
 *   ISCL_RPC_URL_{chainId} — Per-chain RPC URLs (e.g., ISCL_RPC_URL_1, ISCL_RPC_URL_8453)
 *
 * Usage:
 *   node dist/core/demo-boot.js
 */

import { buildApp } from "./api/app.js";
import { buildRpcClient } from "./rpc/build-rpc-client.js";
import { EncryptedKeystore } from "@clavion/signer";

const PORT = Number(process.env.ISCL_PORT ?? 3100);
const HOST = process.env.ISCL_HOST ?? "127.0.0.1";
const PASSPHRASE = process.env.ISCL_DEMO_PASSPHRASE ?? "test-passphrase-123";
const AUTO_APPROVE = process.env.ISCL_AUTO_APPROVE === "true";

async function main(): Promise<void> {
  const rpcClient = buildRpcClient(process.env as Record<string, string | undefined>);
  const auditDbPath = process.env["ISCL_AUDIT_DB"] ?? "./iscl-audit.sqlite";
  const keystorePath = process.env["ISCL_KEYSTORE_PATH"];

  // Resolve approval mode: env var takes precedence, then AUTO_APPROVE fallback
  const envMode = process.env["ISCL_APPROVAL_MODE"] as "cli" | "web" | "auto" | undefined;
  const approvalMode = envMode ?? (AUTO_APPROVE ? "auto" : "cli");

  const app = await buildApp({
    logger: true,
    rpcClient,
    auditDbPath,
    keystorePath,
    approvalMode,
  });

  // Unlock all keys in keystore on the app's keystore instance
  if (keystorePath) {
    const appKeystore = (app as unknown as { keystore: EncryptedKeystore }).keystore;
    const addresses = appKeystore.listAddresses();

    for (const addr of addresses) {
      try {
        await appKeystore.unlock(addr, PASSPHRASE);
        console.log(`[demo-boot] Unlocked wallet: ${addr}`);
      } catch (err) {
        console.warn(
          `[demo-boot] Failed to unlock ${addr}: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[demo-boot] ISCL Core listening on ${HOST}:${PORT}`);
    console.log(`[demo-boot] Approval mode: ${approvalMode}`);
    if (approvalMode === "web") {
      console.log(`[demo-boot] Web approval UI: http://${HOST}:${PORT}/approval-ui`);
    }
  } catch (err) {
    console.error("[demo-boot] Failed to start:", err);
    process.exit(1);
  }

  // Graceful shutdown on SIGTERM/SIGINT
  const shutdown = async (signal: string) => {
    console.log(`[demo-boot] Received ${signal}, shutting down gracefully…`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main();
