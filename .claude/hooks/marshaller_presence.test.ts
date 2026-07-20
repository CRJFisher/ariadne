import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  compute_marshaller_nudge,
  marshaller_nudge_with_dedup,
  marshaller_context_output,
} from "./marshaller_presence.js";

async function make_project(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marshaller-nudge-"));
  await fs.mkdir(path.join(dir, "packages", "core", "src", "widget"), { recursive: true });
  return dir;
}

function leaf(project_dir: string, ...segments: string[]): string {
  return path.join(project_dir, ...segments);
}

describe("compute_marshaller_nudge", () => {
  let project_dir: string;

  beforeEach(async () => {
    project_dir = await make_project();
  });

  afterEach(async () => {
    await fs.rm(project_dir, { recursive: true, force: true });
  });

  it("nudges a new language variant with no sibling marshaller", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.typescript.ts");
    expect(compute_marshaller_nudge(file_path, project_dir)).toEqual(
      "This is a new `widget.typescript.ts` variant with no `widget.ts` beside it. " +
        "A folder with language variants needs an in-folder `widget.ts` marshaller owning the " +
        "dispatch switch — do not displace dispatch into a stage orchestrator. " +
        "Gold standard: import_resolution/import_resolution.ts.",
    );
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

  it("nudges once per session for a folder, then dedupes a second variant", () => {
    const first = leaf(project_dir, "packages", "core", "src", "widget", "widget.typescript.ts");
    const second = leaf(project_dir, "packages", "core", "src", "widget", "widget.rust.ts");

    expect(marshaller_nudge_with_dedup(first, project_dir, "session-a", state_dir)).not.toEqual(null);
    expect(marshaller_nudge_with_dedup(second, project_dir, "session-a", state_dir)).toEqual(null);
  });

  it("nudges again for the same folder under a different session", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.typescript.ts");

    expect(marshaller_nudge_with_dedup(file_path, project_dir, "session-a", state_dir)).not.toEqual(null);
    expect(marshaller_nudge_with_dedup(file_path, project_dir, "session-b", state_dir)).not.toEqual(null);
  });

  it("nudges without recording state when no session id is present", () => {
    const file_path = leaf(project_dir, "packages", "core", "src", "widget", "widget.typescript.ts");

    expect(marshaller_nudge_with_dedup(file_path, project_dir, undefined, state_dir)).not.toEqual(null);
    expect(marshaller_nudge_with_dedup(file_path, project_dir, undefined, state_dir)).not.toEqual(null);
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
