import { createRequire } from "node:module";
import { Ajv, type ErrorObject } from "ajv";
import { SkillManifestSchema } from "../../spec/schemas/skill-manifest-schema.js";

const require = createRequire(import.meta.url);
const addFormats = require("ajv-formats") as (ajv: Ajv) => void;

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

const validateManifestFn = ajv.compile(SkillManifestSchema);

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }> | null;
}

export function validateManifest(data: unknown): ValidationResult {
  const valid = validateManifestFn(data);
  if (valid) {
    return { valid: true, errors: null };
  }
  const errors = (validateManifestFn.errors ?? []).map((e: ErrorObject) => ({
    path: e.instancePath || "/",
    message: e.message ?? "unknown validation error",
  }));
  return { valid: false, errors };
}
