export const transferTemplate = `Extract the ERC-20 token transfer parameters from the user's message.

{{recentMessages}}

Given the recent messages, extract:
- tokenAddress: the ERC-20 contract address (0x...) — required
- recipient: the destination wallet address (0x...) — required
- amount: the amount in token base units (wei) as a string — required

Respond with a JSON block:
\`\`\`json
{
  "tokenAddress": "0x...",
  "recipient": "0x...",
  "amount": "..."
}
\`\`\``;

export const transferNativeTemplate = `Extract the native ETH transfer parameters from the user's message.

{{recentMessages}}

Given the recent messages, extract:
- recipient: the destination wallet address (0x...) — required
- amount: the amount in wei as a string — required

Respond with a JSON block:
\`\`\`json
{
  "recipient": "0x...",
  "amount": "..."
}
\`\`\``;

export const approveTemplate = `Extract the ERC-20 approval parameters from the user's message.

{{recentMessages}}

Given the recent messages, extract:
- tokenAddress: the ERC-20 contract address (0x...) — required
- spender: the contract address to approve (0x...) — required
- amount: the approval amount in token base units (wei) as a string — required

Respond with a JSON block:
\`\`\`json
{
  "tokenAddress": "0x...",
  "spender": "0x...",
  "amount": "..."
}
\`\`\``;

export const swapTemplate = `Extract the token swap parameters from the user's message.

{{recentMessages}}

Given the recent messages, extract:
- router: the swap router contract address (0x...) — required
- tokenIn: the input token contract address (0x...) — required
- tokenOut: the output token contract address (0x...) — required
- amountIn: the input amount in token base units (wei) as a string — required
- minAmountOut: the minimum output amount in base units as a string — required
- provider: the swap provider, either "uniswap_v3" or "1inch" — optional, omit if not mentioned

Respond with a JSON block:
\`\`\`json
{
  "router": "0x...",
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "...",
  "minAmountOut": "...",
  "provider": "uniswap_v3"
}
\`\`\``;

export const balanceTemplate = `Extract the balance check parameters from the user's message.

{{recentMessages}}

Given the recent messages, extract:
- tokenAddress: the ERC-20 contract address (0x...) — required

Respond with a JSON block:
\`\`\`json
{
  "tokenAddress": "0x..."
}
\`\`\``;
