# Sandbox Skill Development Guide

This guide covers how to write, test, and deploy skills that execute inside ISCL's sandboxed containers (Domain C).

---

## Overview

Sandbox skills are self-contained programs that run inside Docker containers with aggressive isolation: no network access, read-only filesystem, no Linux capabilities, and no process spawning. They communicate with ISCL Core exclusively through the HTTP API at a configured `ISCL_API_URL`.

This isolation means a sandbox skill cannot:
- Access private keys or signing functions directly
- Connect to the internet or external APIs
- Read or write the host filesystem
- Spawn child processes (unless explicitly allowed in the manifest)
- Escape the container to affect other processes

What a sandbox skill **can** do:
- Perform computation (data analysis, decision logic, price calculations)
- Read from `/tmp` (writable tmpfs, 64MB, non-executable)
- Call ISCL Core's API to request transactions, check balances, or read status
- Return structured output via stdout

---

## Skill Architecture

```
Host Machine
├── ISCL Core (Domain B, port 3100)
│   ├── /v1/tx/approve-request
│   ├── /v1/balance/:token/:account
│   └── ...
│
└── Docker Container (Domain C)
    ├── Environment: ISCL_API_URL, ISCL_SKILL_NAME
    ├── Filesystem: read-only root, writable /tmp
    ├── Network: none
    └── Skill code (your program)
```

The sandbox runner launches the container, waits for it to complete (or timeout), and captures stdout/stderr as the skill output.

---

## Skill Input and Output

### SkillInput

The sandbox runner provides context to the skill via environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `ISCL_API_URL` | ISCL Core HTTP endpoint | `http://host.docker.internal:3100` |
| `ISCL_SKILL_NAME` | Registered name of this skill | `my-rebalancer` |

Additional input can be passed via stdin or mounted as a read-only file, depending on the skill runner implementation.

### SkillOutput

The sandbox runner captures the container's execution result:

```typescript
interface SkillOutput {
  success: boolean;    // true if exit code === 0
  exitCode: number;    // Container exit code
  stdout: string;      // Captured stdout (up to 10MB)
  stderr: string;      // Captured stderr
  durationMs: number;  // Wall-clock execution time
}
```

- **Exit code 0** = success, any other = failure
- **Stdout** should contain structured output (JSON recommended)
- **Stderr** is captured for debugging but not parsed

---

## Writing a Skill

### Step 1: Create the Skill Script

A skill can be written in any language that runs in the container image. Here is a minimal Node.js example that checks a balance and optionally requests a transfer:

```javascript
// run.mjs — Sandbox skill example
const API_URL = process.env.ISCL_API_URL;
const SKILL_NAME = process.env.ISCL_SKILL_NAME;

async function main() {
  // 1. Check balance
  const wallet = "0xYourWalletAddress";
  const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  const balanceRes = await fetch(
    `${API_URL}/v1/balance/${usdcAddress}/${wallet}?chainId=8453`
  );
  const balance = await balanceRes.json();
  console.log(`USDC balance: ${balance.balance}`);

  // 2. Conditional logic — only transfer if balance > threshold
  const threshold = BigInt("1000000000"); // 1000 USDC
  if (BigInt(balance.balance) > threshold) {
    // 3. Request a transfer through ISCL Core
    const intent = {
      version: "1",
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      chain: { type: "evm", chainId: 8453 },
      wallet: { address: wallet },
      action: {
        type: "transfer",
        asset: { kind: "erc20", address: usdcAddress },
        to: "0xRecipientAddress",
        amount: "500000000", // 500 USDC
      },
      constraints: {
        maxGasWei: "1000000000000000",
        deadline: Math.floor(Date.now() / 1000) + 3600,
        maxSlippageBps: 0,
      },
      metadata: { source: SKILL_NAME },
    };

    const approveRes = await fetch(`${API_URL}/v1/tx/approve-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });

    if (!approveRes.ok) {
      console.error(`Approval failed: ${approveRes.status}`);
      process.exit(1);
    }

    const approval = await approveRes.json();
    console.log(JSON.stringify({ action: "transfer_requested", approval }));
  } else {
    console.log(JSON.stringify({ action: "no_action", reason: "below_threshold" }));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

**Important:** The skill calls `approve-request`, not `sign-and-send`. The full pipeline (policy, preflight, user approval, signing, broadcast) is handled by ISCL Core. The skill only expresses intent.

### Step 2: Create a Dockerfile

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY run.mjs .
CMD ["node", "run.mjs"]
```

Build the image with the naming convention `iscl-skill-{name}:latest`:

```bash
docker build -t iscl-skill-my-rebalancer:latest .
```

### Step 3: Create a Skill Manifest

```json
{
  "version": "1",
  "name": "my-rebalancer",
  "publisher": {
    "name": "Your Name",
    "address": "0xYourPublisherAddress",
    "contact": "you@example.com"
  },
  "permissions": {
    "actions": ["transfer"],
    "chains": [8453],
    "network": false,
    "filesystem": false
  },
  "sandbox": {
    "memoryMb": 128,
    "timeoutMs": 30000,
    "allowSpawn": false
  },
  "files": [
    { "path": "run.mjs", "sha256": "<sha256-of-run.mjs>" }
  ],
  "signature": "<ecdsa-signature>"
}
```

See the [Skill Registry Workflow](skill-registry.md) for details on signing the manifest and computing file hashes.

---

## Container Restrictions

The sandbox runner applies these Docker flags:

| Flag | Effect |
|------|--------|
| `--network none` | No network access from inside the container |
| `--read-only` | Root filesystem is read-only |
| `--tmpfs /tmp:rw,noexec,size=64m` | Writable temp space, non-executable, 64MB limit |
| `--memory {N}m` | Memory limit from manifest (1-512 MB) |
| `--cpus 0.5` | Half a CPU core |
| `--cap-drop ALL` | All Linux capabilities removed |
| `--security-opt no-new-privileges` | Cannot escalate privileges |
| `--security-opt seccomp={profile}` | Block `clone`, `fork`, `exec` syscalls (unless `allowSpawn: true`) |

### Networking Exception

The container has `--network none` but can reach ISCL Core because the API URL points to the Docker host. In Docker Compose, this is configured through the internal Docker network. In standalone mode, use `host.docker.internal` (macOS/Windows) or `--add-host host.docker.internal:host-gateway` (Linux).

### Why No Spawn?

By default, `allowSpawn: false` applies a seccomp profile that blocks process-spawning syscalls. This prevents:
- Fork bombs (denial of service via resource exhaustion)
- Escaping the container's PID namespace
- Executing unexpected binaries

If your skill genuinely needs child processes (e.g., running a compiled binary), set `allowSpawn: true` in the manifest. The skill registry's static scanner will flag this for review.

---

## Testing a Sandbox Skill

### Local Testing (Outside Container)

Test your skill logic first without Docker:

```bash
ISCL_API_URL=http://localhost:3100 ISCL_SKILL_NAME=my-rebalancer node run.mjs
```

This requires ISCL Core to be running. Use `ISCL_APPROVAL_MODE=auto` for testing so approvals don't block.

### Container Testing

Test inside the actual sandbox to verify restrictions:

```bash
# Build the skill image
docker build -t iscl-skill-my-rebalancer:latest .

# Run with sandbox restrictions (mimicking the sandbox runner)
docker run --rm \
  --network none \
  --read-only \
  --tmpfs /tmp:rw,noexec,size=64m \
  --memory 128m \
  --cpus 0.5 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --env ISCL_API_URL=http://host.docker.internal:3100 \
  --env ISCL_SKILL_NAME=my-rebalancer \
  iscl-skill-my-rebalancer:latest
```

**Note:** With `--network none`, the skill cannot reach ISCL Core. For integration testing, either:
- Use Docker Compose with a shared internal network (the sandbox runner handles this)
- Remove `--network none` temporarily for testing, then re-add for production

### Automated Testing with the Sandbox Runner

The project includes sandbox integration tests in `tests/security/sandbox-isolation.test.ts`. These verify that containers:
- Cannot access the host filesystem
- Cannot make outbound network connections
- Are killed on timeout
- Respect memory limits
- Are prevented from spawning processes (when `allowSpawn: false`)

---

## Debugging

### Container Fails to Start

Check that the image exists and matches the naming convention:

```bash
docker images | grep iscl-skill-my-rebalancer
```

### Skill Times Out

The manifest's `timeoutMs` controls the execution deadline. If exceeded, the container is killed with SIGKILL (exit code 137). Increase the timeout or optimize the skill logic.

Check the audit trail for timeout events:

```sql
SELECT * FROM audit_events
WHERE event = 'sandbox_error'
  AND json_extract(data, '$.error') = 'timeout'
ORDER BY timestamp DESC;
```

### Permission Denied Errors

- Writing to the filesystem? Only `/tmp` is writable.
- Running a binary? Check that `allowSpawn: true` is set in the manifest.
- Network calls failing? The container has no network access. All API calls must go through `ISCL_API_URL`.

### Inspecting Skill Output

The sandbox runner captures stdout and stderr. Check the audit trail:

```sql
SELECT * FROM audit_events
WHERE event IN ('sandbox_started', 'sandbox_completed', 'sandbox_error')
ORDER BY timestamp DESC
LIMIT 10;
```

---

## Security Checklist

Before submitting a skill to the registry:

- [ ] Skill does not require network access (or documents why `network: true` is needed)
- [ ] Skill does not require process spawning (or documents why `allowSpawn: true` is needed)
- [ ] All file hashes in the manifest match the actual files
- [ ] Manifest is signed with the publisher's key
- [ ] Memory and timeout limits are set conservatively
- [ ] Skill handles errors gracefully (non-zero exit on failure)
- [ ] Stdout output is structured JSON
- [ ] No secrets or credentials are hardcoded in the skill
- [ ] Skill has been tested with full sandbox restrictions enabled

---

## References

- [Skill Registry Workflow](skill-registry.md) -- Manifest creation, signing, registration pipeline
- [Threat Model](../architecture/threat-model.md) -- Domain C threat analysis
- [ADR-001: Trust Domain Isolation](../architecture/adrs/001-trust-domain-isolation.md) -- Domain C design rationale
- [Security Tests](../development/testing.md) -- Sandbox isolation test suite
