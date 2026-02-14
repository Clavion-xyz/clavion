import * as readline from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { Writable } from "node:stream";

/**
 * Read a single line from stdin.
 * If stdin is a TTY, displays the prompt on stderr.
 * If stdin is piped, reads silently (e.g. `echo "key" | clavion-cli key import`).
 */
export async function readSecretLine(prompt?: string): Promise<string> {
  if (process.stdin.isTTY && prompt) {
    stderr.write(prompt);
  }
  const rl = readline.createInterface({ input: stdin, terminal: false });
  const line = await new Promise<string>((resolve, reject) => {
    rl.once("line", resolve);
    rl.once("error", reject);
    rl.once("close", () => reject(new Error("stdin closed without input")));
  });
  rl.close();
  return line.trim();
}

/**
 * Read a passphrase with masked input (no echo).
 * Uses a muted output stream to suppress typed characters.
 * Prompt is written to stderr so piped stdout remains clean.
 */
export async function readPassphrase(
  prompt: string = "Passphrase: ",
): Promise<string> {
  if (!process.stdin.isTTY) {
    // Piped input — read a line silently
    return readSecretLine();
  }

  // Muted writable — suppresses all output (hides typed characters)
  const muted = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  stderr.write(prompt);

  const rl = readline.createInterface({
    input: stdin,
    output: muted,
    terminal: true,
  });

  const answer = await rl.question("");
  rl.close();
  stderr.write("\n");

  return answer;
}

/**
 * Read a passphrase with confirmation — prompts twice and verifies match.
 */
export async function readPassphraseConfirmed(
  prompt?: string,
): Promise<string> {
  const pass1 = await readPassphrase(prompt ?? "Enter passphrase: ");
  const pass2 = await readPassphrase("Confirm passphrase: ");
  if (pass1 !== pass2) {
    throw new Error("Passphrases do not match");
  }
  return pass1;
}
