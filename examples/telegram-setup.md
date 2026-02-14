# Clavion Telegram Bot Setup

This guide walks through connecting a Telegram bot to Clavion so users can
execute secure crypto operations from a Telegram chat.

## Prerequisites

1. **ISCL Core running** on `http://localhost:3100`
2. **Wallet imported and unlocked** via `clavion-cli key import`
3. **RPC configured** (e.g., `BASE_RPC_URL` for Base chain)
4. **Node.js** >= 20

## Step 1: Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a name and username.
3. BotFather will return a **bot token** like `7123456789:AAF...`. Save this.

## Step 2: Set Environment Variables

```bash
# Required
export TELEGRAM_BOT_TOKEN="7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export ISCL_API_URL="http://localhost:3100"

# Recommended: restrict to specific chat IDs for security
export ISCL_TELEGRAM_ALLOWED_CHATS="123456789,987654321"

# Optional: default wallet address (so users don't need to specify it)
export ISCL_WALLET_ADDRESS="0xYourWalletAddress"
```

To find your Telegram chat ID, message [@userinfobot](https://t.me/userinfobot).

## Step 3: Start ISCL Core

Start the core with web-based approval so you can approve transactions
from a browser rather than the CLI:

```bash
ISCL_APPROVAL_MODE=web npm start
```

This opens a web UI for reviewing and approving pending transactions.

## Step 4: Start the Telegram Bot

```bash
npm run bot:telegram
```

The bot connects to Telegram via long polling and listens for commands.

## Step 5: Interact with the Bot

Open your Telegram bot and try these messages:

```
Check my USDC balance
```
> Returns your USDC balance on Base.

```
Transfer 5 USDC to 0xRecipientAddress
```
> Bot builds the intent, runs policy checks, and asks you to approve
> via the web UI before signing and broadcasting.

```
Swap 10 USDC for WETH
```
> Bot builds a Uniswap V3 swap intent with slippage protection, runs
> preflight simulation, and requests approval.

```
Send 0.01 ETH to 0xRecipientAddress
```
> Native ETH transfer through the secure pipeline.

## Security Considerations

- **Always set `ISCL_TELEGRAM_ALLOWED_CHATS`** in production. Without it,
  anyone who discovers your bot can attempt to trigger transactions.
  Only listed chat IDs will be able to interact with the bot.

- **Use `ISCL_APPROVAL_MODE=web`** so that every fund-affecting operation
  requires explicit approval through the web UI. Never use `auto` mode
  with a public-facing Telegram bot.

- **Private keys never leave ISCL Core.** The Telegram bot is a Domain A
  adapter -- it has no access to keys, signing, or direct RPC calls.

- **All operations are audit-logged** with correlated `intentId` values
  for full traceability.

- **Rate limiting** is enforced by the policy engine (`maxTxPerHour`),
  providing an additional safeguard against abuse.
