---
name: sandbox-executor
description: >
  ISCL Sandbox Executor (Domain C) for container-based skill isolation. Use when working on
  the sandbox runner, container configuration, network/filesystem/process restrictions,
  execution tracing, or debugging sandbox enforcement. Triggers: sandbox, container runner,
  Docker isolation, network allowlist, filesystem restrictions, no_spawn, cgroup limits,
  skill execution environment.
---

# Sandbox Executor

The Sandbox Executor runs untrusted skill code in Domain C — fully isolated from keys and
unrestricted network access. It communicates with ISCL Core only via the localhost API.

## Isolation Layers

```
Container (Docker v0.1)
├── Network: disabled by default OR allowlist-only via proxy
├── Filesystem: read-only rootfs + ephemeral /tmp
├── Processes: no_spawn (no child_process, exec, spawn)
├── Resources: cgroup limits (memory, CPU, timeout)
└── Keys: ABSENT — not mounted, not in env, not accessible
```

## Container Configuration

```typescript
interface SandboxConfig {
  image: string;              // base image for skill runtime
  networkMode: "none" | "allowlist";
  allowedHosts?: string[];    // only if networkMode === "allowlist"
  readOnlyRootfs: true;
  memoryLimitMb: number;      // from SkillManifest.sandbox.memoryMb
  cpuQuota: number;           // microseconds per period
  timeoutMs: number;          // from SkillManifest.sandbox.timeoutMs
  noSpawn: boolean;           // from SkillManifest.sandbox.allowSpawn (inverted)
  volumes: VolumeMount[];     // ephemeral only, no host mounts
  env: Record<string, string>; // NEVER includes key material
}
```

## Docker Run Equivalent

```bash
docker run \
  --rm \
  --network none \
  --read-only \
  --memory 128m \
  --cpus 0.5 \
  --tmpfs /tmp:rw,noexec,size=64m \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --env ISCL_API_URL=http://host.docker.internal:PORT \
  skill-image:latest
```

## Key Implementation Rules

1. **Never mount key material** — no host volumes with `~/.iscl/keystore`
2. **Never pass secrets in env** — `ISCL_API_URL` is the only connection to Core
3. Network `none` is the default — skills that need network require explicit allowlist in manifest
4. Enforce timeouts — kill container after `timeoutMs`
5. Trace all API calls from sandbox → ISCL Core for audit
6. On violation (network attempt, spawn attempt) → log `security_violation` event + terminate

## Execution Flow

```
1. SkillRegistryService loads manifest
2. Verify manifest signature + file hashes
3. SandboxRunner creates container from config
4. Skill code executes, calls ISCL API via localhost
5. ISCL Core handles TxIntent through normal pipeline
6. Container destroyed after completion or timeout
7. Execution trace logged to AuditTrace
```

## Trace Logging (v0.1)

Not syscall-level. Log:
- Container start/stop events
- API calls from sandbox (via ISCL Core access log)
- Network attempts (if proxy is used)
- Timeout/OOM kills
- Any `security_violation` events

## Migration Path to v0.2

Docker → rootless Podman or Firecracker/Nanoclaw WASM executor for stricter isolation.
Design the SandboxRunner interface to be implementation-agnostic.
