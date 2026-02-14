import type { FastifyInstance } from "fastify";
import type { RpcClient } from "@clavion/types/rpc";
import { resolveRpc } from "../../rpc/resolve-rpc.js";

export interface BalanceRouteServices {
  rpcClient: RpcClient | null;
}

export function createBalanceRoutes(services: BalanceRouteServices) {
  return async function balanceRoutes(app: FastifyInstance): Promise<void> {
    const { rpcClient } = services;

    // GET /v1/balance/:token/:account?chainId=8453 — Read ERC-20 balance
    app.get<{
      Params: { token: string; account: string };
      Querystring: { chainId?: string };
    }>("/v1/balance/:token/:account", {
      schema: {
        params: {
          type: "object",
          required: ["token", "account"],
          properties: {
            token: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
            account: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            chainId: { type: "string", pattern: "^[0-9]+$" },
          },
        },
      },
      handler: async (request, reply) => {
        const chainId = request.query.chainId ? Number(request.query.chainId) : undefined;
        const resolvedRpc = chainId
          ? resolveRpc(rpcClient, chainId)
          : rpcClient;

        if (!resolvedRpc) {
          const chainMsg = chainId
            ? ` for chain ${chainId}`
            : "";
          return reply.code(502).send({
            error: "no_rpc_client",
            message: `Balance lookup requires an RPC client${chainMsg}, which is not configured.`,
          });
        }

        const token = request.params.token as `0x${string}`;
        const account = request.params.account as `0x${string}`;

        try {
          const balance = await resolvedRpc.readBalance(token, account);
          return reply.code(200).send({
            token,
            account,
            balance: balance.toString(),
            ...(chainId !== undefined ? { chainId } : {}),
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
