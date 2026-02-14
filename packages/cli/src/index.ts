/**
 * @clavion/cli — Operational CLI for Clavion key management.
 */
export const VERSION = "0.1.0";

export { readSecretLine, readPassphrase, readPassphraseConfirmed } from "./io.js";
export {
  handleKeyCommand,
  handleKeyImport,
  handleKeyImportMnemonic,
  handleKeyGenerate,
  handleKeyList,
  parseKeyOptions,
} from "./commands/key.js";
export type { IOProvider } from "./commands/key.js";
