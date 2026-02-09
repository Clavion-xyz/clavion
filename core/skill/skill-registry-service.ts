import Database from "better-sqlite3";
import { validateManifest } from "./manifest-validator.js";
import {
  verifyManifest,
  computeManifestHash,
} from "./manifest-signer.js";
import { verifyFileHashes } from "./file-hasher.js";
import { scanFiles } from "./static-scanner.js";
import type {
  SkillManifest,
  RegisteredSkill,
  RegistrationResult,
} from "../types.js";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS registered_skills (
    name TEXT PRIMARY KEY,
    publisher_address TEXT NOT NULL,
    publisher_name TEXT NOT NULL,
    manifest TEXT NOT NULL,
    manifest_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    registered_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
`;

interface SkillRow {
  name: string;
  publisher_address: string;
  publisher_name: string;
  manifest: string;
  manifest_hash: string;
  status: string;
  registered_at: number;
  revoked_at: number | null;
}

export class SkillRegistryService {
  public readonly db: Database.Database;
  private insertStmt: Database.Statement;
  private getStmt: Database.Statement;
  private listStmt: Database.Statement;
  private revokeStmt: Database.Statement;
  private isRegisteredStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(CREATE_TABLE_SQL);

    this.insertStmt = this.db.prepare(
      "INSERT INTO registered_skills (name, publisher_address, publisher_name, manifest, manifest_hash, status, registered_at) VALUES (?, ?, ?, ?, ?, 'active', ?)",
    );

    this.getStmt = this.db.prepare(
      "SELECT * FROM registered_skills WHERE name = ?",
    );

    this.listStmt = this.db.prepare(
      "SELECT * FROM registered_skills WHERE status = 'active' ORDER BY registered_at ASC",
    );

    this.revokeStmt = this.db.prepare(
      "UPDATE registered_skills SET status = 'revoked', revoked_at = ? WHERE name = ? AND status = 'active'",
    );

    this.isRegisteredStmt = this.db.prepare(
      "SELECT 1 FROM registered_skills WHERE name = ? AND status = 'active'",
    );
  }

  async register(
    manifest: SkillManifest,
    basePath: string,
  ): Promise<RegistrationResult> {
    const name = manifest.name;

    // 1. Validate schema
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      return {
        registered: false,
        name,
        manifestHash: "",
        error: "schema_validation_failed",
        validationErrors: validation.errors ?? [],
      };
    }

    // 2. Verify signature
    const signatureValid = await verifyManifest(manifest);
    if (!signatureValid) {
      return {
        registered: false,
        name,
        manifestHash: "",
        error: "signature_verification_failed",
      };
    }

    // 3. Verify file hashes
    const hashResult = verifyFileHashes(
      basePath,
      manifest.files,
    );
    if (!hashResult.valid) {
      return {
        registered: false,
        name,
        manifestHash: "",
        error: "file_hash_mismatch",
        hashMismatches: hashResult.mismatches,
      };
    }

    // 4. Static scan
    const scanReport = scanFiles(
      basePath,
      manifest.files.map((f) => f.path),
    );
    if (!scanReport.passed) {
      return {
        registered: false,
        name,
        manifestHash: "",
        error: "static_scan_failed",
        scanFindings: scanReport.findings,
      };
    }

    // 5. Check duplicate
    if (this.isRegistered(name)) {
      return {
        registered: false,
        name,
        manifestHash: "",
        error: "duplicate_skill",
      };
    }

    // 6. Insert
    const manifestHash = computeManifestHash(manifest);
    this.insertStmt.run(
      name,
      manifest.publisher.address,
      manifest.publisher.name,
      JSON.stringify(manifest),
      manifestHash,
      Date.now(),
    );

    return { registered: true, name, manifestHash };
  }

  get(name: string): RegisteredSkill | null {
    const row = this.getStmt.get(name) as SkillRow | undefined;
    if (!row) return null;
    return this.rowToSkill(row);
  }

  list(): RegisteredSkill[] {
    const rows = this.listStmt.all() as SkillRow[];
    return rows.map((r) => this.rowToSkill(r));
  }

  revoke(name: string): boolean {
    const result = this.revokeStmt.run(Date.now(), name);
    return result.changes > 0;
  }

  isRegistered(name: string): boolean {
    return this.isRegisteredStmt.get(name) !== undefined;
  }

  close(): void {
    this.db.close();
  }

  private rowToSkill(row: SkillRow): RegisteredSkill {
    return {
      name: row.name,
      publisherAddress: row.publisher_address,
      publisherName: row.publisher_name,
      manifest: JSON.parse(row.manifest) as SkillManifest,
      manifestHash: row.manifest_hash,
      status: row.status as "active" | "revoked",
      registeredAt: row.registered_at,
      revokedAt: row.revoked_at,
    };
  }
}
