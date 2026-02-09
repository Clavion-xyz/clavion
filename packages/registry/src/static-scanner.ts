import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScanFinding, ScanReport } from "@clavion/types";

interface ScanRule {
  id: string;
  patterns: RegExp[];
  severity: "error" | "warning";
  message: string;
}

const SCAN_RULES: ScanRule[] = [
  {
    id: "dynamic_eval",
    patterns: [/\beval\s*\(/, /\bnew\s+Function\s*\(/],
    severity: "error",
    message: "Dynamic code execution detected",
  },
  {
    id: "child_process",
    patterns: [
      /child_process/,
      /\bexec\s*\(/,
      /\bspawn\s*\(/,
      /\bexecFile\s*\(/,
      /\bexecSync\s*\(/,
      /\bspawnSync\s*\(/,
    ],
    severity: "error",
    message: "Process spawning detected",
  },
  {
    id: "network_access",
    patterns: [
      /\bfetch\s*\(/,
      /\brequire\s*\(\s*['"]https?['"]\s*\)/,
      /\bhttp\./,
      /\bhttps\./,
      /\bnet\./,
      /\bdgram\./,
      /\bWebSocket\b/,
      /\bXMLHttpRequest\b/i,
    ],
    severity: "error",
    message: "Network access detected",
  },
  {
    id: "fs_write",
    patterns: [
      /\bwriteFileSync\b/,
      /\bwriteFile\b/,
      /\bmkdirSync\b/,
      /\bunlinkSync\b/,
      /\brmSync\b/,
    ],
    severity: "warning",
    message: "Filesystem write operation detected",
  },
  {
    id: "obfuscation",
    patterns: [
      /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i,
      /\batob\s*\(/,
      /Buffer\.from\s*\([^,]+,\s*['"]base64['"]/,
    ],
    severity: "warning",
    message: "Potentially obfuscated code detected",
  },
];

/**
 * Scan skill source files for suspicious patterns.
 * Returns a ScanReport with findings and a pass/fail verdict.
 *
 * `passed` is true only if there are zero error-severity findings.
 * Warnings are reported but don't fail the scan.
 */
export function scanFiles(basePath: string, filePaths: string[]): ScanReport {
  const findings: ScanFinding[] = [];

  for (const filePath of filePaths) {
    const fullPath = join(basePath, filePath);
    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      findings.push({
        file: filePath,
        line: 0,
        rule: "file_read_error",
        severity: "error",
        message: `Could not read file: ${filePath}`,
      });
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const rule of SCAN_RULES) {
        for (const pattern of rule.patterns) {
          if (pattern.test(line)) {
            findings.push({
              file: filePath,
              line: i + 1,
              rule: rule.id,
              severity: rule.severity,
              message: rule.message,
            });
            // Only report the first pattern match per rule per line
            break;
          }
        }
      }
    }
  }

  const hasErrors = findings.some((f) => f.severity === "error");
  return { passed: !hasErrors, findings };
}
