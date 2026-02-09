import { createPublicClient, http } from "viem";
import type { RpcClient, CallParams, CallResult, TransactionReceipt } from "@clavion/types/rpc";

const erc20BalanceOfAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const erc20AllowanceAbi = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export class ViemRpcClient implements RpcClient {
  private readonly client: ReturnType<typeof createPublicClient>;

  constructor(rpcUrl: string) {
    this.client = createPublicClient({
      transport: http(rpcUrl),
    });
  }

  async call(params: CallParams): Promise<CallResult> {
    try {
      const result = await this.client.call({
        to: params.to,
        data: params.data,
        account: params.from,
        value: params.value,
      });

      return {
        success: true,
        returnData: (result.data ?? "0x") as `0x${string}`,
      };
    } catch (err: unknown) {
      const reason =
        err instanceof Error ? err.message : "unknown revert reason";
      return {
        success: false,
        returnData: "0x",
        revertReason: reason,
      };
    }
  }

  async estimateGas(params: CallParams): Promise<bigint> {
    return this.client.estimateGas({
      to: params.to,
      data: params.data,
      account: params.from,
      value: params.value,
    });
  }

  async readBalance(
    token: `0x${string}`,
    account: `0x${string}`,
  ): Promise<bigint> {
    const result = await this.client.readContract({
      address: token,
      abi: erc20BalanceOfAbi,
      functionName: "balanceOf",
      args: [account],
    });
    return result;
  }

  async readNativeBalance(account: `0x${string}`): Promise<bigint> {
    return this.client.getBalance({ address: account });
  }

  async readAllowance(
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
  ): Promise<bigint> {
    const result = await this.client.readContract({
      address: token,
      abi: erc20AllowanceAbi,
      functionName: "allowance",
      args: [owner, spender],
    });
    return result;
  }

  async sendRawTransaction(signedTx: `0x${string}`): Promise<`0x${string}`> {
    return this.client.sendRawTransaction({ serializedTransaction: signedTx });
  }

  async getTransactionCount(address: `0x${string}`): Promise<number> {
    return this.client.getTransactionCount({ address, blockTag: "pending" });
  }

  async estimateFeesPerGas(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const block = await this.client.getBlock();
    const baseFee = block.baseFeePerGas ?? 0n;
    // 2x baseFee + 1 gwei priority tip
    return {
      maxFeePerGas: baseFee * 2n + 1_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
    };
  }

  async getTransactionReceipt(hash: `0x${string}`): Promise<TransactionReceipt | null> {
    try {
      const receipt = await this.client.getTransactionReceipt({ hash });
      return {
        transactionHash: receipt.transactionHash,
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        from: receipt.from,
        to: receipt.to,
        contractAddress: receipt.contractAddress ?? null,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          topics: [...log.topics],
          data: log.data,
        })),
      };
    } catch {
      return null;
    }
  }
}
