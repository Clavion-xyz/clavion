/**
 * Demo boot script — unlocks test wallet and starts ISCL Core
 * with auto-approve enabled for the demo environment.
 *
 * Environment:
 *   ISCL_DEMO_PASSPHRASE — passphrase for test keystore (default: "test-passphrase-123")
 *   ISCL_AUTO_APPROVE    — "true" to auto-approve all transactions (default: false)
 *   BASE_RPC_URL         — Anvil fork URL
 *
 * Usage:
 *   node dist/core/demo-boot.js
 */

import { buildApp } from "./api/app.js";
import { ViemRpcClient } from "./rpc/viem-rpc-client.js";
import { EncryptedKeystore } from "./wallet/keystore.js";

const PORT = Number(process.env.ISCL_PORT ?? 3100);
const HOST = process.env.ISCL_HOST ?? "127.0.0.1";
const PASSPHRASE = process.env.ISCL_DEMO_PASSPHRASE ?? "test-passphrase-123";
const AUTO_APPROVE = process.env.ISCL_AUTO_APPROVE === "true";

async function main(): Promise<void> {
  const rpcUrl = process.env["BASE_RPC_URL"];
  const rpcClient = rpcUrl ? new ViemRpcClient(rpcUrl) : undefined;
  const auditDbPath = process.env["ISCL_AUDIT_DB"] ?? "./iscl-audit.sqlite";
  const keystorePath = process.env["ISCL_KEYSTORE_PATH"];

  // Auto-approve prompt function for demo
  const promptFn = AUTO_APPROVE ? async () => true : undefined;

  const app = await buildApp({
    logger: true,
    rpcClient,
    auditDbPath,
    keystorePath,
    promptFn,
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
    if (AUTO_APPROVE) {
      console.log(`[demo-boot] Auto-approve mode ENABLED (demo only)`);
    }
  } catch (err) {
    console.error("[demo-boot] Failed to start:", err);
    process.exit(1);
  }
}

main();
