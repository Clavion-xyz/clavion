import { execFile } from "node:child_process";
import type { AuditTraceService } from "../core/audit/audit-trace-service.js";
import type { SkillInput, SkillOutput } from "../core/types.js";

export interface SandboxRunner {
  run(input: SkillInput): Promise<SkillOutput>;
  isAvailable(): Promise<boolean>;
}

export class DockerSandboxRunner implements SandboxRunner {
  constructor(
    private seccompPath: string,
    private auditTrace: AuditTraceService,
  ) {}

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile("docker", ["info"], (error) => {
        resolve(error === null);
      });
    });
  }

  async run(input: SkillInput): Promise<SkillOutput> {
    const startTime = Date.now();
    const args = this.buildDockerArgs(input);

    this.auditTrace.log("sandbox_started", {
      intentId: "sandbox",
      skillName: input.skillName,
      memoryMb: input.manifest.sandbox.memoryMb,
      networkMode: "none",
    });

    return new Promise((resolve) => {
      const child = execFile(
        "docker",
        args,
        {
          maxBuffer: 10 * 1024 * 1024,
          timeout: input.manifest.sandbox.timeoutMs,
        },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startTime;

          if (error && "killed" in error && error.killed) {
            this.auditTrace.log("sandbox_error", {
              intentId: "sandbox",
              skillName: input.skillName,
              error: "timeout",
            });
            resolve({
              success: false,
              exitCode: 137,
              stdout,
              stderr: stderr + "\nContainer killed: timeout exceeded",
              durationMs,
            });
            return;
          }

          const exitCode = error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0;
          const numericExitCode = typeof exitCode === "number" ? exitCode : 1;

          if (numericExitCode !== 0) {
            this.auditTrace.log("sandbox_error", {
              intentId: "sandbox",
              skillName: input.skillName,
              error: stderr || error?.message || "non-zero exit",
              exitCode: numericExitCode,
            });
          } else {
            this.auditTrace.log("sandbox_completed", {
              intentId: "sandbox",
              skillName: input.skillName,
              exitCode: numericExitCode,
              durationMs,
            });
          }

          resolve({
            success: numericExitCode === 0,
            exitCode: numericExitCode,
            stdout,
            stderr,
            durationMs,
          });
        },
      );

      // Safety: ensure container is killed on timeout
      const timeoutHandle = setTimeout(() => {
        if (child.pid) {
          child.kill("SIGKILL");
        }
      }, input.manifest.sandbox.timeoutMs + 1000);

      child.on("exit", () => {
        clearTimeout(timeoutHandle);
      });
    });
  }

  private buildDockerArgs(input: SkillInput): string[] {
    const { manifest } = input;
    const args = [
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--memory",
      `${manifest.sandbox.memoryMb}m`,
      "--cpus",
      "0.5",
      "--tmpfs",
      "/tmp:rw,noexec,size=64m",
      "--security-opt",
      "no-new-privileges",
      "--cap-drop",
      "ALL",
    ];

    // Apply seccomp profile for no-spawn enforcement
    if (!manifest.sandbox.allowSpawn) {
      args.push("--security-opt", `seccomp=${this.seccompPath}`);
    }

    // Environment — NEVER include key material
    args.push("--env", `ISCL_API_URL=${input.apiUrl}`);
    args.push("--env", `ISCL_SKILL_NAME=${input.skillName}`);

    // Image name derived from skill name
    args.push(`iscl-skill-${manifest.name}:latest`);

    return args;
  }
}
