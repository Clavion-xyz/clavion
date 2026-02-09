/**
 * RPC client interface for EVM chain interactions.
 */

export interface CallParams {
  to: `0x${string}`;
  data: `0x${string}`;
  from?: `0x${string}`;
  value?: bigint;
}

export interface CallResult {
  success: boolean;
  returnData: `0x${string}`;
  revertReason?: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  status: "success" | "reverted";
  blockNumber: string;
  blockHash: string;
  gasUsed: string;
  effectiveGasPrice: string;
  from: string;
  to: string | null;
  contractAddress: string | null;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

export interface RpcClient {
  /** eth_call simulation */
  call(params: CallParams): Promise<CallResult>;

  /** eth_estimateGas */
  estimateGas(params: CallParams): Promise<bigint>;

  /** ERC20 balanceOf */
  readBalance(token: `0x${string}`, account: `0x${string}`): Promise<bigint>;

  /** Native ETH balance (eth_getBalance) */
  readNativeBalance(account: `0x${string}`): Promise<bigint>;

  /** ERC20 allowance */
  readAllowance(
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
  ): Promise<bigint>;

  /** eth_getTransactionReceipt */
  getTransactionReceipt(hash: `0x${string}`): Promise<TransactionReceipt | null>;

  /** eth_sendRawTransaction */
  sendRawTransaction(signedTx: `0x${string}`): Promise<`0x${string}`>;

  /** eth_getTransactionCount (pending nonce) */
  getTransactionCount(address: `0x${string}`): Promise<number>;

  /** EIP-1559 fee estimation */
  estimateFeesPerGas(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
}
