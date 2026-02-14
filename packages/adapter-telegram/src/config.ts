export interface TelegramAdapterConfig {
  botToken: string;
  iscl: { baseUrl: string; timeoutMs: number };
  allowedChatIds: Set<number>;
  walletAddress: string;
  chainId: number;
  pollIntervalMs: number;
  approvalTimeoutMs: number;
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): TelegramAdapterConfig {
  const botToken = env["TELEGRAM_BOT_TOKEN"];
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
  }

  const walletAddress = env["ISCL_WALLET_ADDRESS"];
  if (!walletAddress) {
    throw new Error("ISCL_WALLET_ADDRESS environment variable is required");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    throw new Error(
      `ISCL_WALLET_ADDRESS must be a valid Ethereum address (0x + 40 hex chars), got: ${walletAddress}`,
    );
  }

  const allowedChatsStr = env["ISCL_TELEGRAM_ALLOWED_CHATS"] ?? "";
  const allowedChatIds = new Set<number>(
    allowedChatsStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
      .filter((n) => !Number.isNaN(n)),
  );

  const chainId = Number(env["ISCL_CHAIN_ID"] ?? "8453");
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error(
      `ISCL_CHAIN_ID must be a positive integer, got: ${env["ISCL_CHAIN_ID"]}`,
    );
  }

  return {
    botToken,
    iscl: {
      baseUrl: env["ISCL_API_URL"] ?? "http://127.0.0.1:3100",
      timeoutMs: Number(env["ISCL_TIMEOUT_MS"] ?? "30000"),
    },
    allowedChatIds,
    walletAddress,
    chainId,
    pollIntervalMs: 500,
    approvalTimeoutMs: 300_000,
  };
}
