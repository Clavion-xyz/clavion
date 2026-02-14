import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ClavionService } from "./service.js";

export const walletProvider: Provider = {
  name: "clavionWallet",
  description: "Provides Clavion wallet address and connection status",
  position: -1,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ) => {
    const address = runtime.getSetting("ISCL_WALLET_ADDRESS");
    if (!address || typeof address !== "string") {
      return {
        text: "Clavion wallet: not configured (ISCL_WALLET_ADDRESS missing)",
        values: { clavionConfigured: false },
      };
    }

    const service = runtime.getService<ClavionService>("clavion");
    if (!service) {
      return {
        text: `Clavion wallet: ${address}\nStatus: service not available`,
        values: { walletAddress: address, clavionConfigured: false },
      };
    }

    try {
      const client = service.getClient();
      const health = await client.health();
      return {
        text: `Clavion wallet: ${address}\nISCL Core: connected (v${health.version})\nAll transactions are policy-enforced and require approval.`,
        values: {
          walletAddress: address,
          clavionConfigured: true,
          coreVersion: health.version,
        },
      };
    } catch {
      return {
        text: `Clavion wallet: ${address}\nISCL Core: disconnected`,
        values: { walletAddress: address, clavionConfigured: false },
      };
    }
  },
};
