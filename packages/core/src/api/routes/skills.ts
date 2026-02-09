import type { FastifyInstance } from "fastify";
import type { SkillRegistryService } from "@clavion/registry";
import type { AuditTraceService } from "@clavion/audit";
import type { SkillManifest } from "@clavion/types";

export interface SkillRouteServices {
  registry: SkillRegistryService;
  auditTrace: AuditTraceService;
}

export function createSkillRoutes(services: SkillRouteServices) {
  return async function skillRoutes(app: FastifyInstance): Promise<void> {
    const { registry, auditTrace } = services;

    // POST /v1/skills/register
    app.post<{ Body: { manifest: SkillManifest; basePath: string } }>(
      "/v1/skills/register",
      async (request, reply) => {
        const { manifest, basePath } = request.body as {
          manifest: SkillManifest;
          basePath: string;
        };

        const result = await registry.register(manifest, basePath);

        if (result.registered) {
          auditTrace.log("skill_registered", {
            intentId: "system",
            skillName: result.name,
            manifestHash: result.manifestHash,
            publisherAddress: manifest.publisher.address,
          });
          return reply.status(200).send(result);
        }

        if (result.error === "duplicate_skill") {
          auditTrace.log("skill_registration_failed", {
            intentId: "system",
            skillName: result.name,
            reason: result.error,
          });
          return reply.status(409).send(result);
        }

        auditTrace.log("skill_registration_failed", {
          intentId: "system",
          skillName: result.name,
          reason: result.error,
        });
        return reply.status(400).send(result);
      },
    );

    // GET /v1/skills
    app.get("/v1/skills", async (_request, reply) => {
      const skills = registry.list();
      return reply.status(200).send(skills);
    });

    // GET /v1/skills/:name
    app.get<{ Params: { name: string } }>(
      "/v1/skills/:name",
      async (request, reply) => {
        const { name } = request.params;
        const skill = registry.get(name);
        if (!skill) {
          return reply.status(404).send({ error: "skill_not_found", name });
        }
        return reply.status(200).send(skill);
      },
    );

    // DELETE /v1/skills/:name
    app.delete<{ Params: { name: string } }>(
      "/v1/skills/:name",
      async (request, reply) => {
        const { name } = request.params;
        const revoked = registry.revoke(name);
        if (!revoked) {
          return reply.status(404).send({ error: "skill_not_found", name });
        }
        auditTrace.log("skill_revoked", {
          intentId: "system",
          skillName: name,
        });
        return reply.status(200).send({ revoked: true, name });
      },
    );
  };
}
