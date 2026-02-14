import { buildApp } from "./api/app.js";
import { buildRpcClient } from "./rpc/build-rpc-client.js";

const PORT = Number(process.env.ISCL_PORT ?? 3100);
const HOST = process.env.ISCL_HOST ?? "127.0.0.1";

async function main(): Promise<void> {
  const rpcClient = buildRpcClient(process.env as Record<string, string | undefined>);
  const auditDbPath = process.env["ISCL_AUDIT_DB"] ?? "./iscl-audit.sqlite";
  const keystorePath = process.env["ISCL_KEYSTORE_PATH"];
  const approvalMode = (process.env["ISCL_APPROVAL_MODE"] ?? "cli") as "cli" | "web" | "auto";
  const oneInchApiKey = process.env["ONEINCH_API_KEY"];
  const app = await buildApp({ logger: true, rpcClient, auditDbPath, keystorePath, approvalMode, oneInchApiKey });

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.fatal(err, "Failed to start ISCL Core");
    process.exit(1);
  }

  // Graceful shutdown on SIGTERM/SIGINT
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully…`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main();
