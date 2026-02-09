import type { FastifyInstance } from "fastify";

const HealthResponseSchema = {
  type: "object",
  required: ["status", "version"],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["ok"] },
    version: { type: "string" },
    uptime: { type: "number" },
  },
} as const;

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get("/v1/health", {
    schema: {
      response: { 200: HealthResponseSchema },
    },
    handler: async () => {
      return {
        status: "ok" as const,
        version: "0.1.0",
        uptime: process.uptime(),
      };
    },
  });
}
