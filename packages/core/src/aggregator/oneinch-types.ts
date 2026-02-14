/** Request parameters for 1inch Swap API v6.0 GET /swap endpoint. */
export interface OneInchSwapParams {
  /** Source token address (tokenIn). */
  src: string;
  /** Destination token address (tokenOut). */
  dst: string;
  /** Amount of source token in base units (wei). */
  amount: string;
  /** Wallet address that will execute the swap. */
  from: string;
  /** Slippage tolerance as a percentage string, e.g. "1" for 1%. */
  slippage: string;
  /** Skip gas estimation on 1inch side — we do our own preflight. */
  disableEstimate?: boolean;
  /** Whether to allow partial fills. */
  allowPartialFill?: boolean;
}

/** Successful response from 1inch Swap API v6.0. */
export interface OneInchSwapResponse {
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gas: number;
    gasPrice: string;
  };
  toAmount: string;
  fromAmount: string;
  protocols: unknown[];
}

/** Request parameters for 1inch Quote API v6.0 GET /quote endpoint. */
export interface OneInchQuoteParams {
  src: string;
  dst: string;
  amount: string;
}

/** Successful response from 1inch Quote API v6.0. */
export interface OneInchQuoteResponse {
  toAmount: string;
  fromAmount: string;
  gas: number;
  protocols: unknown[];
}
