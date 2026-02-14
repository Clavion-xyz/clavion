# Telegram Bot Setup Guide

This guide covers setting up the Clavion Telegram bot (`@clavion/adapter-telegram`) for interacting with ISCL Core through Telegram chat.

---

## Overview

The Telegram bot is a Domain A adapter built with [grammY](https://grammy.dev/). It provides a conversational interface for requesting crypto operations: transfers, swaps, approvals, and balance checks. The bot renders inline approval keyboards so the operator can approve or deny transactions directly in the chat.

### How It Works

```
Telegram User                    Bot                        ISCL Core
    |                             |                            |
    |  /transfer 100 USDC to 0x  |                            |
    |---->                        |                            |
    |                             | POST /v1/tx/approve-request|
    |                             |--->                        |
    |  [Approve] [Deny]           |                            |
    |<----                        |  (request blocks)          |
    |                             |                            |
    |  (taps Approve)             |                            |
    |---->                        |                            |
    |                             | POST /v1/approvals/:id/decide
    |                             |--->                        |
    |                             |         approval token     |
    |                             |<---                        |
    |                             | POST /v1/tx/sign-and-send  |
    |                             |--->                        |
    |                             |         tx hash            |
    |  "Signed! TX: 0xabc..."     |<---                        |
    |<----                        |                            |
```

The bot uses a split pipeline:
1. Sends `approve-request` to ISCL Core (which blocks waiting for approval)
2. Polls `/v1/approvals/pending` to find the pending request ID
3. Renders an inline keyboard with Approve/Deny buttons
4. On user tap, calls `/v1/approvals/:id/decide`
5. The blocked `approve-request` resolves with an approval token
6. Calls `sign-and-send` with the token

---

## Prerequisites

- **ISCL Core running** with `ISCL_APPROVAL_MODE=web` (required -- the bot uses web approval)
- **A Telegram bot token** from [@BotFather](https://t.me/BotFather)
- **A wallet address** imported into the ISCL keystore
- **Node.js 20+**

---

## Step 1: Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to name your bot
3. BotFather gives you a token like `7123456789:AAH1234567890abcdef...`
4. Save this token -- you'll need it for `TELEGRAM_BOT_TOKEN`

Optionally, set commands for the bot menu:

```
/setcommands
```

Then paste:

```
transfer - Transfer ERC-20 tokens
send - Send native ETH
swap - Swap tokens via DEX
approve - Approve ERC-20 spending
balance - Check wallet balance
status - Check ISCL Core status
help - Show available commands
```

---

## Step 2: Get Your Chat ID

The bot can be restricted to specific Telegram chats for security. To find your chat ID:

1. Start your bot (send it `/start`)
2. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find the `"chat": { "id": 123456789 }` in the response
4. Use this number for `ISCL_TELEGRAM_ALLOWED_CHATS`

For group chats, the ID is typically negative (e.g., `-1001234567890`).

---

## Step 3: Configure Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | -- | Bot token from BotFather |
| `ISCL_WALLET_ADDRESS` | Yes | -- | Wallet address to sign with (must be in keystore) |
| `ISCL_API_URL` | No | `http://127.0.0.1:3100` | ISCL Core base URL |
| `ISCL_CHAIN_ID` | No | `8453` (Base) | Default chain for transactions |
| `ISCL_TELEGRAM_ALLOWED_CHATS` | No | (allow all) | Comma-separated chat IDs |
| `ISCL_TIMEOUT_MS` | No | `30000` | HTTP request timeout (ms) |

**Security warning:** If `ISCL_TELEGRAM_ALLOWED_CHATS` is empty, the bot accepts commands from **any** chat. Always set this in production.

---

## Step 4: Start ISCL Core with Web Approval Mode

The Telegram bot requires web approval mode because it uses the HTTP approval API to submit decisions:

```bash
ISCL_APPROVAL_MODE=web \
ISCL_RPC_URL_8453=https://mainnet.base.org \
npm run dev
```

Verify Core is running:

```bash
curl http://localhost:3100/v1/health
```

---

## Step 5: Start the Bot

```bash
cd packages/adapter-telegram

TELEGRAM_BOT_TOKEN=7123456789:AAH1234... \
ISCL_WALLET_ADDRESS=0xYourWalletAddress \
ISCL_TELEGRAM_ALLOWED_CHATS=123456789 \
ISCL_CHAIN_ID=8453 \
npx tsx src/index.ts
```

You should see:

```
Telegram bot started. Listening for commands...
```

---

## Bot Commands

### /transfer

Transfer ERC-20 tokens.

```
/transfer 100 USDC to 0xRecipientAddress
```

Parameters are parsed from the message. The bot will:
1. Build a TxIntent with `action.type: "transfer"`
2. Send to ISCL Core for approval
3. Show an inline keyboard: **[Approve] [Deny]**
4. On approval, sign and broadcast
5. Report the transaction hash

### /send

Transfer native ETH.

```
/send 0.1 ETH to 0xRecipientAddress
```

### /swap

Swap tokens via DEX.

```
/swap 100 USDC for WETH
```

Supports both Uniswap V3 and 1inch (if `ONEINCH_API_KEY` is configured on Core).

### /approve

Approve ERC-20 spending allowance.

```
/approve 1000 USDC for 0xSpenderContract
```

### /balance

Check wallet balance.

```
/balance
/balance USDC
```

### /status

Check ISCL Core status (health endpoint).

```
/status
```

---

## Approval Flow

When a transaction command is sent, the bot renders an inline keyboard:

```
Transfer 100.0 USDC to 0xAbCd...1234

Chain: Base (8453)
Risk Score: 15/100
Gas Estimate: 0.0001 ETH

[Approve] [Deny]
```

**Security enforcement:**
- Only the user who initiated the transaction can tap Approve/Deny (same-sender check)
- Each approval keyboard is tied to a specific request ID
- Expired requests (>300s TTL) cannot be approved
- Tapping Approve triggers `sign-and-send`; Deny cancels the pipeline

---

## Authentication

### Allowed Chat IDs

Set `ISCL_TELEGRAM_ALLOWED_CHATS` to restrict which chats can use the bot:

```bash
# Single chat
ISCL_TELEGRAM_ALLOWED_CHATS=123456789

# Multiple chats
ISCL_TELEGRAM_ALLOWED_CHATS=123456789,-1001234567890
```

If a message arrives from an unauthorized chat, the bot silently ignores it.

### Same-Sender Enforcement

Callback queries (button taps) are verified against the original command sender. If user A sends `/transfer` and user B taps Approve, the bot rejects B's tap with "Only the transaction initiator can decide."

---

## Running in Docker

Add the Telegram bot as a service in your Docker Compose:

```yaml
services:
  iscl-core:
    build:
      context: ..
      dockerfile: docker/Dockerfile.core
    ports:
      - "127.0.0.1:3100:3100"
    environment:
      ISCL_APPROVAL_MODE: web
      ISCL_RPC_URL_8453: https://mainnet.base.org

  telegram-bot:
    build:
      context: ..
      dockerfile: packages/adapter-telegram/Dockerfile
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      ISCL_WALLET_ADDRESS: ${ISCL_WALLET_ADDRESS}
      ISCL_API_URL: http://iscl-core:3100
      ISCL_CHAIN_ID: 8453
      ISCL_TELEGRAM_ALLOWED_CHATS: ${ISCL_TELEGRAM_ALLOWED_CHATS}
    depends_on:
      - iscl-core
```

The bot container uses `http://iscl-core:3100` (Docker internal DNS) to reach ISCL Core.

---

## Multi-Chain Usage

Set `ISCL_CHAIN_ID` to change the default chain:

| Chain | ID | Command |
|-------|----|---------|
| Ethereum | 1 | `ISCL_CHAIN_ID=1` |
| Optimism | 10 | `ISCL_CHAIN_ID=10` |
| Arbitrum | 42161 | `ISCL_CHAIN_ID=42161` |
| Base | 8453 | `ISCL_CHAIN_ID=8453` (default) |

Ensure the corresponding `ISCL_RPC_URL_{chainId}` is configured on ISCL Core.

---

## Troubleshooting

### Bot doesn't respond

1. Check that `TELEGRAM_BOT_TOKEN` is correct (test with `curl https://api.telegram.org/bot<TOKEN>/getMe`)
2. Check that your chat ID is in `ISCL_TELEGRAM_ALLOWED_CHATS`
3. Check bot logs for errors

### "Transaction expired or not found"

The approval TTL is 300 seconds. If you wait too long to tap Approve/Deny, the request expires. Submit the command again.

### ISCL Core connection errors

Verify Core is running and reachable:

```bash
curl http://localhost:3100/v1/health
```

If running in Docker, ensure the bot uses the Docker service name (`http://iscl-core:3100`), not `localhost`.

### "Only the transaction initiator can decide"

Someone other than the command sender tried to tap the approval button. Only the original sender can approve or deny.

---

## References

- [Configuration Reference](../configuration.md) -- All environment variables
- [API Reference](../api/overview.md) -- Endpoints used by the bot
- [Web Approval UI](../operations/commands-and-workflows.md) -- Web-based approval dashboard
- [Multi-Chain Operations](../operations/multi-chain.md) -- Chain configuration
