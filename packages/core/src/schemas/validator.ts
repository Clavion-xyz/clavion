import { createRequire } from "node:module";
import { Ajv, type ErrorObject } from "ajv";
import { TxIntentSchema } from "@clavion/types/schemas";

const require = createRequire(import.meta.url);
const addFormats = require("ajv-formats") as (ajv: Ajv) => void;

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

const validateTxIntentFn = ajv.compile(TxIntentSchema);

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }> | null;
}

export function validateTxIntent(data: unknown): ValidationResult {
  const valid = validateTxIntentFn(data);
  if (valid) {
    return { valid: true, errors: null };
  }
  const errors = (validateTxIntentFn.errors ?? []).map((e: ErrorObject) => ({
    path: e.instancePath || "/",
    message: e.message ?? "unknown validation error",
  }));
  return { valid: false, errors };
}
