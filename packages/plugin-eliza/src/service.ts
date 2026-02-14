import { Service, type IAgentRuntime } from "@elizaos/core";
import { ISCLClient } from "./shared/iscl-client.js";

export class ClavionService extends Service {
  static serviceType = "clavion";
  capabilityDescription = "Clavion ISCL secure transaction signing";

  private client: ISCLClient | null = null;

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new ClavionService(runtime);
    const apiUrl = runtime.getSetting("ISCL_API_URL");
    const baseUrl = typeof apiUrl === "string" ? apiUrl : "http://127.0.0.1:3100";

    service.client = new ISCLClient({ baseUrl });

    try {
      await service.client.health();
    } catch {
      // Core may not be running yet — log but don't fail plugin init
    }

    return service;
  }

  async stop(): Promise<void> {
    this.client = null;
  }

  getClient(): ISCLClient {
    if (!this.client) {
      throw new Error("ClavionService not initialized — call start() first");
    }
    return this.client;
  }
}
