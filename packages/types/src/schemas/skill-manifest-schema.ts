/**
 * SkillManifest v1 JSON Schema — canonical AJV-compatible schema.
 * Source: ISCL Skill Packaging specification.
 */
export const SkillManifestSchema = {
  type: "object",
  required: [
    "version",
    "name",
    "publisher",
    "permissions",
    "sandbox",
    "files",
    "signature",
  ],
  additionalProperties: false,
  properties: {
    version: { const: "1" },
    name: {
      type: "string",
      pattern: "^[a-z0-9-]+$",
      minLength: 1,
      maxLength: 64,
    },
    publisher: {
      type: "object",
      required: ["name", "address", "contact"],
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1 },
        address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        contact: { type: "string", format: "email" },
      },
    },
    permissions: {
      type: "object",
      required: ["txActions", "chains", "networkAccess", "filesystemAccess"],
      additionalProperties: false,
      properties: {
        txActions: {
          type: "array",
          items: {
            type: "string",
            enum: ["transfer", "approve", "swap_exact_in", "swap_exact_out"],
          },
          uniqueItems: true,
        },
        chains: {
          type: "array",
          items: { type: "integer", minimum: 1 },
        },
        networkAccess: { type: "boolean" },
        filesystemAccess: { type: "boolean" },
      },
    },
    sandbox: {
      type: "object",
      required: ["memoryMb", "timeoutMs", "allowSpawn"],
      additionalProperties: false,
      properties: {
        memoryMb: { type: "integer", minimum: 1, maximum: 512 },
        timeoutMs: { type: "integer", minimum: 1000, maximum: 60000 },
        allowSpawn: { type: "boolean" },
      },
    },
    files: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["path", "sha256"],
        additionalProperties: false,
        properties: {
          path: { type: "string", minLength: 1 },
          sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
        },
      },
    },
    signature: { type: "string", pattern: "^0x[0-9a-fA-F]+$" },
  },
} as const;
