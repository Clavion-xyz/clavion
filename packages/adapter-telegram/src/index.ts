#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { ISCLClient } from "./shared/iscl-client.js";
import { createBot } from "./bot.js";

const config = loadConfig();
const client = new ISCLClient({
  baseUrl: config.iscl.baseUrl,
  timeoutMs: config.iscl.timeoutMs,
});

// Non-fatal health check
try {
  await client.health();
  console.log("[clavion-telegram] ISCL Core health check passed");
} catch {
  console.warn(
    "[clavion-telegram] ISCL Core not reachable — bot will start but commands may fail",
  );
}

const bot = createBot({ client, config });

bot.start();
console.log("[clavion-telegram] Bot started");
