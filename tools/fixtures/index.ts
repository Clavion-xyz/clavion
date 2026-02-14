import {
  validTransferIntent,
  validApproveIntent,
  validSwapExactInIntent,
  validSwapExactInOneInchIntent,
  validSwapExactOutIntent,
  validTransferNativeIntent,
} from "./valid-intents.js";
import {
  missingAction,
  unknownField,
  wrongVersion,
  badAddress,
  nonNumericAmount,
  negativeDeadline,
  unknownActionType,
  extraActionField,
  nativeTransferWithAsset,
} from "./invalid-intents.js";
export { expectedHashes } from "./hash-fixtures.js";
export {
  validManifest,
  invalidManifests,
} from "./skill-manifests.js";
export {
  TEST_PRIVATE_KEY,
  TEST_PASSPHRASE,
  FAST_SCRYPT,
  INTENT_ID,
  TX_REQUEST_HASH,
  TEST_MNEMONIC_12,
  TEST_MNEMONIC_24,
} from "./test-keys.js";
export { mockRpcClient, mockRpcClientWithSpies } from "./mock-rpc.js";
export { noApprovalConfig, approvalRequiredConfig } from "./test-policy.js";

export const validFixtures = {
  transfer: validTransferIntent,
  approve: validApproveIntent,
  swapExactIn: validSwapExactInIntent,
  swapExactInOneInch: validSwapExactInOneInchIntent,
  swapExactOut: validSwapExactOutIntent,
  transferNative: validTransferNativeIntent,
};

export const invalidFixtures = {
  missingAction,
  unknownField,
  wrongVersion,
  badAddress,
  nonNumericAmount,
  negativeDeadline,
  unknownActionType,
  extraActionField,
  nativeTransferWithAsset,
};
