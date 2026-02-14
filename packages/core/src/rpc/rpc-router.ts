import type { RpcClient, CallParams, CallResult, TransactionReceipt } from "@clavion/types/rpc";

/**
 * Routes RPC calls to chain-specific clients.
 *
 * Implements RpcClient interface for backward compatibility — default
 * delegation goes to the first configured chain (or explicit defaultChainId).
 * Use `forChain(chainId)` to get a chain-specific client.
 */
export class RpcRouter implements RpcClient {
  private readonly clients: Map<number, RpcClient>;
  private readonly defaultChainId: number;

  constructor(clients: Map<number, RpcClient>, defaultChainId?: number) {
    if (clients.size === 0) {
      throw new Error("RpcRouter requires at least one chain client");
    }
    this.clients = clients;
    this.defaultChainId = defaultChainId ?? clients.keys().next().value!;
  }

  /** Get the chain-specific RpcClient. Throws if chain not configured. */
  forChain(chainId: number): RpcClient {
    const client = this.clients.get(chainId);
    if (!client) {
      throw new Error(
        `No RPC client configured for chain ${chainId}. Available: [${[...this.clients.keys()].join(", ")}]`,
      );
    }
    return client;
  }

  /** Check if a chain has an RPC client configured. */
  hasChain(chainId: number): boolean {
    return this.clients.has(chainId);
  }

  /** List all configured chain IDs. */
  get chainIds(): number[] {
    return [...this.clients.keys()];
  }

  // ---- RpcClient interface delegation to defaultChainId (backward compat) ----

  async call(params: CallParams): Promise<CallResult> {
    return this.forChain(this.defaultChainId).call(params);
  }

  async estimateGas(params: CallParams): Promise<bigint> {
    return this.forChain(this.defaultChainId).estimateGas(params);
  }

  async readBalance(token: `0x${string}`, account: `0x${string}`): Promise<bigint> {
    return this.forChain(this.defaultChainId).readBalance(token, account);
  }

  async readNativeBalance(account: `0x${string}`): Promise<bigint> {
    return this.forChain(this.defaultChainId).readNativeBalance(account);
  }

  async readAllowance(
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
  ): Promise<bigint> {
    return this.forChain(this.defaultChainId).readAllowance(token, owner, spender);
  }

  async getTransactionReceipt(hash: `0x${string}`): Promise<TransactionReceipt | null> {
    return this.forChain(this.defaultChainId).getTransactionReceipt(hash);
  }

  async sendRawTransaction(signedTx: `0x${string}`): Promise<`0x${string}`> {
    return this.forChain(this.defaultChainId).sendRawTransaction(signedTx);
  }

  async getTransactionCount(address: `0x${string}`): Promise<number> {
    return this.forChain(this.defaultChainId).getTransactionCount(address);
  }

  async estimateFeesPerGas(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    return this.forChain(this.defaultChainId).estimateFeesPerGas();
  }
}
