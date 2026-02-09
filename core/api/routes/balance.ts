import type { FastifyInstance } from "fastify";
import type { RpcClient } from "../../rpc/rpc-client.js";

export interface BalanceRouteServices {
  rpcClient: RpcClient | null;
}

export function createBalanceRoutes(services: BalanceRouteServices) {
  return async function balanceRoutes(app: FastifyInstance): Promise<void> {
    const { rpcClient } = services;

    // GET /v1/balance/:token/:account — Read ERC-20 balance
    app.get<{ Params: { token: string; account: string } }>("/v1/balance/:token/:account", {
      schema: {
        params: {
          type: "object",
          required: ["token", "account"],
          properties: {
            token: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
            account: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
          },
        },
      },
      handler: async (request, reply) => {
        if (!rpcClient) {
          return reply.code(502).send({
            error: "no_rpc_client",
            message: "Balance lookup requires an RPC client, which is not configured.",
          });
        }

        const token = request.params.token as `0x${string}`;
        const account = request.params.account as `0x${string}`;

        try {
          const balance = await rpcClient.readBalance(token, account);
          return reply.code(200).send({
            token,
            account,
            balance: balance.toString(),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Balance lookup failed";
          return reply.code(502).send({
            error: "rpc_error",
            message,
          });
        }
      },
    });
  };
}
