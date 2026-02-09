import { buildApp } from "./api/app.js";
import { ViemRpcClient } from "./rpc/viem-rpc-client.js";

const PORT = Number(process.env.ISCL_PORT ?? 3100);
const HOST = process.env.ISCL_HOST ?? "127.0.0.1";

async function main(): Promise<void> {
  const rpcUrl = process.env["BASE_RPC_URL"];
  const rpcClient = rpcUrl ? new ViemRpcClient(rpcUrl) : undefined;
  const auditDbPath = process.env["ISCL_AUDIT_DB"] ?? "./iscl-audit.sqlite";
  const keystorePath = process.env["ISCL_KEYSTORE_PATH"];
  const app = await buildApp({ logger: true, rpcClient, auditDbPath, keystorePath });

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.fatal(err, "Failed to start ISCL Core");
    process.exit(1);
  }
}

main();
