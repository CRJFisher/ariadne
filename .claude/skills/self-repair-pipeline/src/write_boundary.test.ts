import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(THIS_DIR, "..");

/**
 * Walk `dir` recursively and return every `.ts` path under it. Skips
 * `node_modules`, `dist`, and the test files themselves.
 */
function ts_sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...ts_sources(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("write-boundary contract: self-repair-pipeline never writes the classifier registry", () => {
  it("no source file under self-repair-pipeline contains a registry-write call", () => {
    // The contract documented in .claude/rules/classifier-lifecycle.md:
    // self-repair-pipeline reads the registry but never mutates it. Only the
    // triage-curator (wip lifecycle) and the fix-sequencer reconciler (wip →
    // fixed) are permitted writers.
    const violations: { file: string; lines: string[] }[] = [];
    for (const file of ts_sources(SKILL_ROOT)) {
      const text = fs.readFileSync(file, "utf8");
      const offending_lines: string[] = [];
      for (const line of text.split("\n")) {
        // Heuristic: any call that combines a registry-write API name with
        // a registry-shaped path on the same line.
        const has_write =
          /\b(writeFile|atomic_write_file|serialize_known_issues_registry_json)\b/.test(line);
        const targets_registry = /registry(\.json|_path|_file_path)/.test(line);
        if (has_write && targets_registry) {
          offending_lines.push(line.trim());
        }
      }
      if (offending_lines.length > 0) {
        violations.push({ file: path.relative(SKILL_ROOT, file), lines: offending_lines });
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("triage-coordinator sub-agent contract: Read-only tool allowlist", () => {
  it("declares `tools: Read` and nothing else", () => {
    // The dispatcher is the sole writer of novel_issues.json and
    // coordinator_log.jsonl. The coordinator sub-agent must not be able to
    // mutate any file, run Bash, or invoke other agents — its only role is
    // to return a parsed CoordinatorDecision from the prompt evidence.
    const agent_path = path.resolve(
      SKILL_ROOT,
      "..",
      "..",
      "agents",
      "triage-coordinator.md",
    );
    const text = fs.readFileSync(agent_path, "utf8");
    const frontmatter_match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatter_match) {
      throw new Error("triage-coordinator.md: no frontmatter found");
    }
    const tools_line = frontmatter_match[1]
      .split("\n")
      .find((l) => l.startsWith("tools:"));
    if (tools_line === undefined) {
      throw new Error("triage-coordinator.md: no `tools:` line in frontmatter");
    }
    const value = tools_line.replace(/^tools:\s*/, "").trim();
    expect(value).toEqual("Read");
  });
});
