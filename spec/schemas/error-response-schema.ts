/**
 * Standard error response schema used by all API error responses.
 */
export const ErrorResponseSchema = {
  type: "object",
  required: ["error"],
  additionalProperties: false,
  properties: {
    error: { type: "string" },
    reasons: { type: "array", items: { type: "string" } },
    details: { type: "object" },
  },
} as const;
