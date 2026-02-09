import { execFile, type ChildProcess } from "node:child_process";
import { createPublicClient, http } from "viem";

export interface AnvilFork {
  rpcUrl: string;
  process: ChildProcess;
  stop(): void;
}

/**
 * Check whether the `anvil` binary is available.
 */
export function isAnvilAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("anvil", ["--version"], (error) => {
      resolve(error === null);
    });
  });
}

/**
 * Start an Anvil fork of Base mainnet.
 * Polls until the RPC is responsive (up to 30s).
 */
export async function startAnvilFork(
  baseRpcUrl: string,
  port: number = 8545,
): Promise<AnvilFork> {
  const rpcUrl = `http://127.0.0.1:${port}`;

  const child = execFile("anvil", [
    "--fork-url",
    baseRpcUrl,
    "--port",
    String(port),
    "--chain-id",
    "8453",
    "--silent",
  ]);

  // Wait for Anvil to become responsive
  const maxWait = 30_000;
  const pollInterval = 500;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    try {
      const client = createPublicClient({ transport: http(rpcUrl) });
      await client.getChainId();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  // Verify it's responsive
  const client = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await client.getChainId();
  if (chainId !== 8453) {
    child.kill();
    throw new Error(`Anvil fork has unexpected chain ID: ${chainId}`);
  }

  return {
    rpcUrl,
    process: child,
    stop() {
      child.kill("SIGTERM");
    },
  };
}
