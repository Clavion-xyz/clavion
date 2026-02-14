/**
 * One-time script to generate expected hash values for valid fixtures.
 * Run: npm run generate:hashes
 * Then copy the output into hash-fixtures.ts
 */
import { computeIntentHash } from "@clavion/core";
import {
  validTransferIntent,
  validTransferNativeIntent,
  validApproveIntent,
  validSwapExactInIntent,
  validSwapExactInOneInchIntent,
  validSwapExactOutIntent,
} from "./valid-intents.js";

const hashes = {
  transfer: computeIntentHash(validTransferIntent),
  transferNative: computeIntentHash(validTransferNativeIntent),
  approve: computeIntentHash(validApproveIntent),
  swapExactIn: computeIntentHash(validSwapExactInIntent),
  swapExactInOneInch: computeIntentHash(validSwapExactInOneInchIntent),
  swapExactOut: computeIntentHash(validSwapExactOutIntent),
};

for (const [name, hash] of Object.entries(hashes)) {
  // eslint-disable-next-line no-console
  console.log(`  ${name}: "${hash}",`);
}
