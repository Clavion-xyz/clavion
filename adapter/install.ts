import { ISCLClient } from "./shared/iscl-client.js";

export async function verifyInstallation(
  baseUrl?: string,
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const client = new ISCLClient(baseUrl ? { baseUrl } : undefined);

  // 1. Health check — verify ISCL Core is reachable
  try {
    const health = await client.health();
    if (health.status !== "ok") {
      errors.push(`Unexpected health status: ${String(health.status)}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    errors.push(`Health check failed: ${msg}`);
  }

  // 2. Verify skill modules resolve
  const modules = [
    "./skills/clavion-transfer/index.js",
    "./skills/clavion-approve/index.js",
    "./skills/clavion-swap/index.js",
    "./skills/clavion-balance/index.js",
  ];

  for (const mod of modules) {
    try {
      await import(mod);
    } catch {
      errors.push(`Module resolution failed: ${mod}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
