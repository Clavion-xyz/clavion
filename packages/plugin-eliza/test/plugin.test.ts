import { describe, test, expect } from "vitest";
import { clavionPlugin } from "../src/index.js";

describe("clavionPlugin", () => {
  test("has correct name", () => {
    expect(clavionPlugin.name).toBe("@clavion/plugin-eliza");
  });

  test("has description", () => {
    expect(clavionPlugin.description).toBeDefined();
    expect(clavionPlugin.description!.length).toBeGreaterThan(20);
  });

  test("exports ClavionService in services", () => {
    expect(clavionPlugin.services).toBeDefined();
    expect(clavionPlugin.services).toHaveLength(1);
    expect(clavionPlugin.services![0]).toBeDefined();
  });

  test("exports walletProvider in providers", () => {
    expect(clavionPlugin.providers).toBeDefined();
    expect(clavionPlugin.providers).toHaveLength(1);
    expect(clavionPlugin.providers![0]!.name).toBe("clavionWallet");
  });

  test("exports 5 actions", () => {
    expect(clavionPlugin.actions).toBeDefined();
    expect(clavionPlugin.actions).toHaveLength(5);

    const names = clavionPlugin.actions!.map((a) => a.name);
    expect(names).toContain("CLAVION_TRANSFER");
    expect(names).toContain("CLAVION_TRANSFER_NATIVE");
    expect(names).toContain("CLAVION_APPROVE");
    expect(names).toContain("CLAVION_SWAP");
    expect(names).toContain("CLAVION_CHECK_BALANCE");
  });

  test("each action has similes", () => {
    for (const action of clavionPlugin.actions!) {
      expect(action.similes).toBeDefined();
      expect(action.similes!.length).toBeGreaterThan(0);
    }
  });

  test("each action has examples", () => {
    for (const action of clavionPlugin.actions!) {
      expect(action.examples).toBeDefined();
      expect(action.examples!.length).toBeGreaterThan(0);
    }
  });

  test("each action has description", () => {
    for (const action of clavionPlugin.actions!) {
      expect(action.description).toBeDefined();
      expect(action.description!.length).toBeGreaterThan(10);
    }
  });
});
