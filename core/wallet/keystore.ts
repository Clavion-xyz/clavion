import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { privateKeyToAddress } from "viem/accounts";

interface KeystoreMetadata {
  version: "1";
  keys: Array<{ address: string; profile: string; file: string }>;
}

// scrypt parameters (Ethereum keystore standard)
const DEFAULT_SCRYPT_N = 262144; // 2^18
const DEFAULT_SCRYPT_R = 8;
const DEFAULT_SCRYPT_P = 1;
const KEY_LENGTH = 32;

export interface KeystoreOptions {
  /** Override scrypt N parameter. Use low values (e.g. 1024) for tests. */
  scryptN?: number;
}

export class EncryptedKeystore {
  private basePath: string;
  private unlockedKeys: Map<string, `0x${string}`>;
  private metadata: KeystoreMetadata;
  private scryptN: number;

  constructor(basePath: string, options?: KeystoreOptions) {
    this.basePath = basePath;
    this.unlockedKeys = new Map();
    this.scryptN = options?.scryptN ?? DEFAULT_SCRYPT_N;

    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }

    this.metadata = this.loadMetadata();
  }

  private loadMetadata(): KeystoreMetadata {
    const metadataPath = join(this.basePath, "keystore.json");
    if (!existsSync(metadataPath)) {
      return { version: "1", keys: [] };
    }
    return JSON.parse(readFileSync(metadataPath, "utf-8")) as KeystoreMetadata;
  }

  private saveMetadata(): void {
    const metadataPath = join(this.basePath, "keystore.json");
    writeFileSync(metadataPath, JSON.stringify(this.metadata, null, 2), "utf-8");
  }

  async generate(passphrase: string, profile: string = "default"): Promise<string> {
    const privateKey = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
    return this.importKey(privateKey, passphrase, profile);
  }

  async importKey(
    privateKey: `0x${string}`,
    passphrase: string,
    profile: string = "default",
  ): Promise<string> {
    const address = privateKeyToAddress(privateKey).toLowerCase();

    if (this.metadata.keys.some((k) => k.address === address)) {
      throw new Error(`Key for address ${address} already exists in keystore`);
    }

    // Encrypt
    const salt = randomBytes(32);
    const derivedKey = scryptSync(passphrase, salt, KEY_LENGTH, {
      N: this.scryptN,
      r: DEFAULT_SCRYPT_R,
      p: DEFAULT_SCRYPT_P,
    });

    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(privateKey.slice(2), "utf-8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Write encrypted key file
    const fileName = `${address.slice(2, 10)}-${profile}.enc`;
    const encryptedData = {
      address,
      profile,
      cipher: "aes-256-gcm",
      kdf: "scrypt",
      kdfParams: {
        n: this.scryptN,
        r: DEFAULT_SCRYPT_R,
        p: DEFAULT_SCRYPT_P,
        salt: salt.toString("hex"),
      },
      ciphertext: ciphertext.toString("hex"),
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };

    writeFileSync(join(this.basePath, fileName), JSON.stringify(encryptedData, null, 2), "utf-8");

    // Update metadata
    this.metadata.keys.push({ address, profile, file: fileName });
    this.saveMetadata();

    return address;
  }

  async unlock(address: string, passphrase: string): Promise<void> {
    const normalized = address.toLowerCase();
    const keyMeta = this.metadata.keys.find((k) => k.address === normalized);
    if (!keyMeta) {
      throw new Error(`No key found for address ${address}`);
    }

    const keyPath = join(this.basePath, keyMeta.file);
    if (!existsSync(keyPath)) {
      throw new Error(`Encrypted key file not found for address ${address}`);
    }

    const encrypted = JSON.parse(readFileSync(keyPath, "utf-8"));

    // Decrypt
    const salt = Buffer.from(encrypted.kdfParams.salt, "hex");
    const derivedKey = scryptSync(passphrase, salt, KEY_LENGTH, {
      N: encrypted.kdfParams.n,
      r: encrypted.kdfParams.r,
      p: encrypted.kdfParams.p,
    });

    const decipher = createDecipheriv(
      "aes-256-gcm",
      derivedKey,
      Buffer.from(encrypted.iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));

    let decrypted: Buffer;
    try {
      decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "hex")),
        decipher.final(),
      ]);
    } catch {
      throw new Error("Invalid passphrase or corrupted key file");
    }

    const privateKey = `0x${decrypted.toString("utf-8")}` as `0x${string}`;

    // Verify address matches
    const derivedAddress = privateKeyToAddress(privateKey).toLowerCase();
    if (derivedAddress !== normalized) {
      throw new Error("Decrypted key does not match expected address");
    }

    this.unlockedKeys.set(normalized, privateKey);
  }

  lock(address: string): void {
    this.unlockedKeys.delete(address.toLowerCase());
  }

  getUnlockedKey(address: string): `0x${string}` {
    const normalized = address.toLowerCase();
    const key = this.unlockedKeys.get(normalized);
    if (!key) {
      throw new Error(`Key for address ${address} is not unlocked`);
    }
    return key;
  }

  listAddresses(): string[] {
    return this.metadata.keys.map((k) => k.address);
  }

  isUnlocked(address: string): boolean {
    return this.unlockedKeys.has(address.toLowerCase());
  }
}
