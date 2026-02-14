import type { Plugin } from "@elizaos/core";
import { ClavionService } from "./service.js";
import { walletProvider } from "./provider.js";
import { transferAction } from "./actions/transfer.js";
import { transferNativeAction } from "./actions/transfer-native.js";
import { approveAction } from "./actions/approve.js";
import { swapAction } from "./actions/swap.js";
import { balanceAction } from "./actions/balance.js";

export const clavionPlugin: Plugin = {
  name: "@clavion/plugin-eliza",
  description:
    "Secure crypto operations via Clavion ISCL — policy-enforced signing, risk scoring, and audit logging. Replaces direct private key usage with a secure signing layer.",
  services: [ClavionService],
  providers: [walletProvider],
  actions: [
    transferAction,
    transferNativeAction,
    approveAction,
    swapAction,
    balanceAction,
  ],
};

export default clavionPlugin;

// Re-export for direct usage
export { ClavionService } from "./service.js";
export { walletProvider } from "./provider.js";
export { transferAction } from "./actions/transfer.js";
export { transferNativeAction } from "./actions/transfer-native.js";
export { approveAction } from "./actions/approve.js";
export { swapAction } from "./actions/swap.js";
export { balanceAction } from "./actions/balance.js";
export { ISCLClient, ISCLError } from "./shared/iscl-client.js";
export { buildIntent } from "./shared/intent-builder.js";
export { executeSecurePipeline } from "./shared/pipeline.js";
