/**
 * The structural enforcement of "triage-entrypoints never writes
 * registry.json" lives in `packages/skill-fs/src/registry_writers.test.ts`,
 * which walks the whole workspace with the TypeScript compiler and pins
 * the allowlist. The contract is documented in
 * `.claude/rules/classifier-lifecycle.md`.
 *
 * This file keeps the orthogonal `triage-coordinator` sub-agent allowlist
 * check: the agent must declare `tools: Read` only.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(THIS_DIR, "..");

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
