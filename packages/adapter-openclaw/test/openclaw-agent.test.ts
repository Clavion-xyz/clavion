import { describe, test, expect } from "vitest";
import { openclawTools } from "@clavion/adapter-openclaw";

describe("OpenClaw Agent — tool definitions", () => {
  test("exports 5 tool definitions", () => {
    expect(openclawTools).toHaveLength(5);
  });

  test("safe_transfer tool has correct schema", () => {
    const tool = openclawTools.find((t) => t.name === "safe_transfer");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("transfer");
    const params = tool!.parameters as { required: string[]; properties: Record<string, unknown> };
    expect(params.required).toEqual(["walletAddress", "asset", "to", "amount"]);
    expect(params.properties).toHaveProperty("walletAddress");
    expect(params.properties).toHaveProperty("asset");
    expect(params.properties).toHaveProperty("to");
    expect(params.properties).toHaveProperty("amount");
  });

  test("safe_approve tool has correct schema", () => {
    const tool = openclawTools.find((t) => t.name === "safe_approve");
    expect(tool).toBeDefined();
    const params = tool!.parameters as { required: string[] };
    expect(params.required).toEqual(["walletAddress", "asset", "spender", "amount"]);
  });

  test("safe_swap_exact_in tool has correct schema", () => {
    const tool = openclawTools.find((t) => t.name === "safe_swap_exact_in");
    expect(tool).toBeDefined();
    const params = tool!.parameters as { required: string[] };
    expect(params.required).toContain("router");
    expect(params.required).toContain("assetIn");
    expect(params.required).toContain("assetOut");
    expect(params.required).toContain("amountIn");
    expect(params.required).toContain("minAmountOut");
  });

  test("safe_transfer_native tool has correct schema", () => {
    const tool = openclawTools.find((t) => t.name === "safe_transfer_native");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("native ETH");
    const params = tool!.parameters as { required: string[]; properties: Record<string, unknown> };
    expect(params.required).toEqual(["walletAddress", "to", "amount"]);
    expect(params.properties).toHaveProperty("walletAddress");
    expect(params.properties).toHaveProperty("to");
    expect(params.properties).toHaveProperty("amount");
    expect(params.properties).not.toHaveProperty("asset");
  });

  test("check_balance tool has correct schema", () => {
    const tool = openclawTools.find((t) => t.name === "check_balance");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("Read-only");
    const params = tool!.parameters as { required: string[] };
    expect(params.required).toEqual(["walletAddress", "tokenAddress"]);
  });

  test("all tools have name, description, and parameters", () => {
    for (const tool of openclawTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect((tool.parameters as { type: string }).type).toBe("object");
    }
  });
});
