import {
  validTransferIntent,
  validApproveIntent,
  validSwapExactInIntent,
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

export const validFixtures = {
  transfer: validTransferIntent,
  approve: validApproveIntent,
  swapExactIn: validSwapExactInIntent,
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
