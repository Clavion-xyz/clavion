---
name: iscl-api-endpoints
description: >
  ISCL Core API development patterns using Fastify. Use when adding new API endpoints,
  modifying request/response schemas, debugging API validation, or working with the HTTP
  layer. Triggers: API routes, Fastify handlers, endpoint implementation, JSON schema
  validation on API, request/response types, /v1/ routes, health endpoint.
---

# ISCL API Endpoints

ISCL Core exposes a local Fastify HTTP API. All endpoints are versioned under `/v1/`.

## Endpoint Reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/health` | Version + status |
| POST | `/v1/tx/build` | Build transaction from TxIntent |
| POST | `/v1/tx/preflight` | Simulate and score risk |
| POST | `/v1/tx/approve-request` | Generate approval request for user |
| POST | `/v1/tx/sign-and-send` | Sign with approval token and broadcast |
| GET | `/v1/tx/:hash` | Get transaction status/receipt |

## Fastify Route Pattern

```typescript
import { FastifyInstance } from "fastify";
import { TxIntentSchema } from "../spec/schemas/txintent.js";

export async function txBuildRoute(app: FastifyInstance) {
  app.post("/v1/tx/build", {
    schema: {
      body: TxIntentSchema,        // AJV strict validation
      response: {
        200: BuildPlanResponseSchema,
        400: ErrorResponseSchema,
        403: PolicyDeniedSchema,
      },
    },
    handler: async (request, reply) => {
      const intent = request.body as TxIntent;

      // 1. Validate (already done by Fastify/AJV)
      // 2. Policy check
      const policyResult = policyEngine.evaluate(intent, config);
      if (policyResult.decision === "deny") {
        return reply.code(403).send({
          error: "policy_denied",
          reasons: policyResult.reasons,
        });
      }

      // 3. Build transaction
      const buildPlan = await txEngine.build(intent);

      // 4. Log
      auditTrace.log("build_completed", {
        intentId: intent.id,
        txRequestHash: buildPlan.txRequestHash,
      });

      return buildPlan;
    },
  });
}
```

## Key Implementation Rules

1. **Every endpoint** uses AJV JSON Schema for request validation — no manual parsing
2. `additionalProperties: false` on all schemas — reject unknown fields
3. All error responses follow a consistent shape: `{ error: string, reasons?: string[], details?: object }`
4. Audit events logged at every critical step inside handlers
5. No endpoint directly accesses WalletService without PolicyDecision + ApprovalToken
6. All responses include `X-ISCL-Version` header

## Adding a New Endpoint

1. Define request/response JSON Schemas in `/spec/schemas/`
2. Create route file in `/core/api/routes/`
3. Register route in the Fastify app setup
4. Add handler logic following the pattern above
5. Log relevant audit events
6. Write integration tests: valid request, malformed request, policy denial
7. Update OpenAPI spec if applicable

## Error Codes

```typescript
// Standard error responses
"validation_error"    // 400 — AJV schema validation failed
"policy_denied"       // 403 — PolicyEngine denied the intent
"approval_required"   // 403 — Needs human confirmation
"approval_invalid"    // 403 — Token expired/used/mismatched
"intent_expired"      // 400 — Deadline passed
"intent_consumed"     // 409 — Already processed (idempotency)
"build_failed"        // 500 — Transaction construction failed
"preflight_failed"    // 500 — Simulation error
"broadcast_failed"    // 502 — RPC broadcast error
```
