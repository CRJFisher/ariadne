import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  compute_marshaller_nudge,
  marshaller_nudge_with_dedup,
  marshaller_context_output,
} from "./marshaller_nudge.js";

async function make_project(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marshaller-nudge-"));
  await fs.mkdir(path.join(dir, "packages", "core", "src", "widget"), { recursive: true });
  return dir;
}

function leaf(project_dir: string, ...segments: string[]): string {
  return path.join(project_dir, ...segments);
}

function expected_nudge(feature: string, language: string): string {
  return (
    `This is a new \`${feature}.${language}.ts\` variant with no \`${feature}.ts\` beside it. ` +
    `A folder with language variants needs an in-folder \`${feature}.ts\` marshaller owning the ` +
    `dispatch switch — do not displace dispatch into a stage orchestrator ` +
    `(gold standard: resolve_references/import_resolution/import_resolution.ts).`
  );
}

describe("compute_marshaller_nudge", () => {
  let project_dir: string;

  beforeEach(async () => {
    project_dir = await make_project();
  });

  afterEach(async () => {
    await fs.rm(project_dir, { recursive: true, force: true });
  });

  it.each(["typescript", "javascript", "python", "rust"])(
    "nudges a new %s variant with no sibling marshaller",
    (language) => {
      const file_path = leaf(project_dir, "packages", "core", "src", "widget", `widget.${language}.ts`);
      expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(expected_nudge("widget", language));
    },
  );

  it("keeps a nested-dot feature intact in the nudge (greedy match)", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "symbol.resolution.rust.ts");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(expected_nudge("symbol.resolution", "rust"));
  });

  it("stays silent when the sibling marshaller already exists", async () => {
    await fs.writeFile(leaf(project_dir, "packages", "core", "src", "widget", "widget.ts"), "");
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.typescript.ts");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(null);
  });

  it("stays silent when the variant leaf already exists (an edit, not a new leaf)", async () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.rust.ts");
    await fs.writeFile(file_path, "");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(null);
  });

  it("ignores a variant test file", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.python.test.ts");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(null);
  });

  it("ignores a non-language dotted name", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.config.ts");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(null);
  });

  it("ignores an index barrel variant (index.ts is a barrel, not a marshaller)", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "index.rust.ts");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(null);
  });

  it("ignores a plain leaf with no language suffix", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.ts");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(null);
  });

  it("ignores language variants outside packages/core", async () => {
    await fs.mkdir(leaf(project_dir, "packages", "mcp", "src", "widget"), { recursive: true });
    const file_path = leaf(project_dir, "packages", "mcp", "src", "widget", "widget.typescript.ts");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(null);
  });
});

describe("marshaller_nudge_with_dedup", () => {
  let project_dir: string;
  let state_dir: string;

  beforeEach(async () => {
    project_dir = await make_project();
    state_dir = await fs.mkdtemp(path.join(os.tmpdir(), "marshaller-state-"));
  });

  afterEach(async () => {
    await fs.rm(project_dir, { recursive: true, force: true });
    await fs.rm(state_dir, { recursive: true, force: true });
  });

  it("nudges once per session for a feature, then dedupes its second language variant", () => {
    const first = leaf(project_dir, "packages", "core", "src", "widget", "widget.typescript.ts");
    const second = leaf(project_dir, "packages", "core", "src", "widget", "widget.rust.ts");

    expect(marshaller_nudge_with_dedup(first, project_dir, "session-a", state_dir)).toEqual(
      expected_nudge("widget", "typescript"),
    );
    expect(marshaller_nudge_with_dedup(second, project_dir, "session-a", state_dir)).toEqual(null);
  });

  it("still nudges a different feature in the same folder under the same session", () => {
    const widget = leaf(project_dir, "packages", "core", "src", "widget", "widget.rust.ts");
    const parser = leaf(project_dir, "packages", "core", "src", "widget", "parser.rust.ts");

    expect(marshaller_nudge_with_dedup(widget, project_dir, "session-a", state_dir)).toEqual(
      expected_nudge("widget", "rust"),
    );
    expect(marshaller_nudge_with_dedup(parser, project_dir, "session-a", state_dir)).toEqual(
      expected_nudge("parser", "rust"),
    );
  });

  it("nudges again for the same feature under a different session", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.typescript.ts");

    expect(marshaller_nudge_with_dedup(file_path, project_dir, "session-a", state_dir)).toEqual(
      expected_nudge("widget", "typescript"),
    );
    expect(marshaller_nudge_with_dedup(file_path, project_dir, "session-b", state_dir)).toEqual(
      expected_nudge("widget", "typescript"),
    );
  });

  it("nudges without recording state when no session id is present", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.typescript.ts");

    expect(marshaller_nudge_with_dedup(file_path, project_dir, undefined, state_dir)).toEqual(
      expected_nudge("widget", "typescript"),
    );
    expect(marshaller_nudge_with_dedup(file_path, project_dir, undefined, state_dir)).toEqual(
      expected_nudge("widget", "typescript"),
    );
  });
});

describe("marshaller_context_output", () => {
  it("wraps the nudge as PreToolUse additionalContext with no block decision", () => {
    const output = marshaller_context_output("hello");
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: "hello",
      },
    });
    expect("decision" in output).toEqual(false);
  });
});
