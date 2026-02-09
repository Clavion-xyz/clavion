import type { SkillManifest } from "@clavion/types";

export const validManifest: SkillManifest = {
  version: "1",
  name: "example-transfer-skill",
  publisher: {
    name: "ISCL Test Publisher",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    contact: "publisher@example.com",
  },
  permissions: {
    txActions: ["transfer"],
    chains: [8453],
    networkAccess: false,
    filesystemAccess: false,
  },
  sandbox: {
    memoryMb: 128,
    timeoutMs: 10000,
    allowSpawn: false,
  },
  files: [
    {
      path: "index.js",
      sha256: "a".repeat(64),
    },
  ],
  signature: "0x" + "ab".repeat(65),
};

export const invalidManifests = {
  missingName: (() => {
    const m = { ...validManifest };
    const { name: _, ...rest } = m;
    return rest;
  })(),

  badAddress: {
    ...validManifest,
    publisher: {
      ...validManifest.publisher,
      address: "not-an-address",
    },
  },

  unknownPermission: {
    ...validManifest,
    permissions: {
      ...validManifest.permissions,
      txActions: ["transfer", "unknown_action"],
    },
  },

  exceededSandboxMemory: {
    ...validManifest,
    sandbox: {
      ...validManifest.sandbox,
      memoryMb: 1024,
    },
  },

  exceededSandboxTimeout: {
    ...validManifest,
    sandbox: {
      ...validManifest.sandbox,
      timeoutMs: 120000,
    },
  },

  emptyFiles: {
    ...validManifest,
    files: [],
  },

  missingSignature: (() => {
    const m = { ...validManifest };
    const { signature: _, ...rest } = m;
    return rest;
  })(),

  unknownField: {
    ...validManifest,
    unknownField: "should fail",
  },

  badFileHash: {
    ...validManifest,
    files: [
      {
        path: "index.js",
        sha256: "ZZZZ", // not hex, not 64 chars
      },
    ],
  },

  badNamePattern: {
    ...validManifest,
    name: "Invalid Name With Spaces!",
  },
};
