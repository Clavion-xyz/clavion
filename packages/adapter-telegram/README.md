# @clavion/adapter-telegram

Telegram bot for crypto operations with inline approval buttons. Users issue
commands in chat; the bot builds a TxIntent, shows an approval prompt with
inline keyboard buttons, and signs/broadcasts on confirmation.

## Commands

| Command | Description |
|---------|-------------|
| `/transfer <amount> <token> to <address>` | Transfer ERC-20 tokens |
| `/send <amount> to <address>` | Transfer native ETH |
| `/swap <amount> <tokenIn> for <tokenOut>` | Swap tokens |
| `/approve <amount> <token> for <spender>` | Set ERC-20 allowance |
| `/balance <token>` | Check token balance |
| `/status <txHash>` | Look up transaction receipt |
| `/help` | Show available commands |

## Prerequisites

- ISCL Core running with `ISCL_APPROVAL_MODE=web`
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

The bot uses Core's web approval mode so that inline keyboard callbacks can
submit approve/deny decisions via the pending approval API.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | -- (required) | Bot token from BotFather |
| `ISCL_API_URL` | `http://127.0.0.1:3000` | ISCL Core base URL |
| `ISCL_WALLET_ADDRESS` | -- (required) | Wallet address for transactions |
| `ISCL_CHAIN_ID` | `8453` | Default chain ID |
| `ISCL_TELEGRAM_ALLOWED_CHATS` | -- | Comma-separated chat IDs (empty = allow all) |

## Running

```bash
npm run build
node packages/adapter-telegram/dist/index.js
```

## Example Commands

```
/transfer 100 USDC to 0xabc...def
/swap 1 USDC for WETH
/balance USDC
/send 0.1 to 0xabc...def
/status 0x123...abc
```

## Security

- Only users in `ISCL_TELEGRAM_ALLOWED_CHATS` can interact with the bot
- Only the user who initiated a transaction can approve or deny it
- All operations go through Core's policy engine, preflight, and audit trace

## Project Root

[Back to main README](../../README.md)
