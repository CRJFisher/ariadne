/**
 * Every `.claude/agents/*.md` frontmatter must parse under a strict YAML
 * loader. The harness parses agent frontmatter with a real YAML parser, so an
 * unquoted scalar containing a colon-space (e.g. a long description citing
 * "`packages/core` code: validates") raises a ScannerError at load time and
 * silently breaks the agent — the pipeline skill that dispatches it fails with
 * no signal pointing at the frontmatter. This test fails the build first.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// packages/skill-fs/src/ → packages/skill-fs → packages → repo root
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const AGENTS_DIR = path.join(REPO_ROOT, ".claude", "agents");

function extract_frontmatter(text: string): string | null {
  // Tolerate a BOM and CRLF so such a file is linted, not misreported as
  // having no frontmatter (mirrors backlog_dedup.ts's normalization).
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

describe("agent frontmatter parses under a strict YAML loader", () => {
  const agent_files = fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"));

  it("finds agent files to lint", () => {
    expect(agent_files.length).toBeGreaterThan(0);
  });

  it.each(agent_files)("%s", (file) => {
    const text = fs.readFileSync(path.join(AGENTS_DIR, file), "utf8");
    const frontmatter = extract_frontmatter(text);
    expect(frontmatter, `${file} has no --- frontmatter block`).not.toBeNull();
    expect(
      () => yaml.load(frontmatter as string),
      `${file} frontmatter failed strict YAML parse (reported position is relative to the frontmatter block; quote any value containing a colon-space)`,
    ).not.toThrow();
  });

  // Negative control: the loader must actually reject the colon-space class
  // this test exists to catch, so the guard cannot silently no-op.
  it("rejects an unquoted scalar containing a colon-space", () => {
    const broken =
      "description: reads `packages/core` code: validates the plan";
    expect(() => yaml.load(broken)).toThrow();
  });
});
