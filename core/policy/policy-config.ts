import { readFileSync, existsSync } from "node:fs";
import { Ajv } from "ajv";
import type { PolicyConfig } from "../types.js";

const ajv = new Ajv({ strict: true, allErrors: true });

export const PolicyConfigSchema = {
  type: "object",
  required: [
    "version",
    "maxValueWei",
    "maxApprovalAmount",
    "contractAllowlist",
    "tokenAllowlist",
    "allowedChains",
    "recipientAllowlist",
    "maxRiskScore",
    "requireApprovalAbove",
    "maxTxPerHour",
  ],
  additionalProperties: false,
  properties: {
    version: { const: "1" },
    maxValueWei: { type: "string", pattern: "^[0-9]+$" },
    maxApprovalAmount: { type: "string", pattern: "^[0-9]+$" },
    contractAllowlist: {
      type: "array",
      items: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
    },
    tokenAllowlist: {
      type: "array",
      items: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
    },
    allowedChains: {
      type: "array",
      items: { type: "integer", minimum: 1 },
      minItems: 1,
    },
    recipientAllowlist: {
      type: "array",
      items: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
    },
    maxRiskScore: { type: "integer", minimum: 0, maximum: 100 },
    requireApprovalAbove: {
      type: "object",
      required: ["valueWei"],
      additionalProperties: false,
      properties: {
        valueWei: { type: "string", pattern: "^[0-9]+$" },
      },
    },
    maxTxPerHour: { type: "integer", minimum: 1 },
  },
} as const;

const validate = ajv.compile(PolicyConfigSchema);

export function getDefaultConfig(): PolicyConfig {
  return {
    version: "1",
    maxValueWei: "0",
    maxApprovalAmount: "0",
    contractAllowlist: [],
    tokenAllowlist: [],
    allowedChains: [8453],
    recipientAllowlist: [],
    maxRiskScore: 50,
    requireApprovalAbove: { valueWei: "0" },
    maxTxPerHour: 10,
  };
}

export function loadPolicyConfig(path: string): PolicyConfig {
  if (!existsSync(path)) {
    return getDefaultConfig();
  }

  const raw = readFileSync(path, "utf-8");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in policy config: ${path}`);
  }

  const valid = validate(data);
  if (!valid) {
    const errors = (validate.errors ?? [])
      .map((e) => `${e.instancePath || "/"}: ${e.message}`)
      .join("; ");
    throw new Error(`Invalid policy config: ${errors}`);
  }

  return data as PolicyConfig;
}
