// Wrapper around shared buildIntent with MCP-specific default source
import { buildIntent as sharedBuildIntent } from "@clavion/adapter-shared";
export type { IntentBuilderOptions } from "@clavion/adapter-shared";

import type { IntentBuilderOptions } from "@clavion/adapter-shared";
import type { TxIntent } from "@clavion/types";

export function buildIntent(options: IntentBuilderOptions): TxIntent {
  return sharedBuildIntent({ source: "mcp-adapter", ...options });
}
