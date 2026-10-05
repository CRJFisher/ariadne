/**
 * Drift guard for the bundled permanent slice: the committed
 * `registry_permanent_data.ts` must byte-equal a fresh render of the source
 * registry (`.claude/skills/triage/known_issues/registry.json`). A hand-edit to either
 * file fails here; the fix is always to edit the registry and rerun
 * `generate_permanent_data.ts` (the `triage` skill scripts directory).
 *
 * A whole-repo invariant test, like skill-fs's `registry_writers.test.ts`:
 * it deliberately reads the committed files, not a temp fixture. The render
 * is the shared `render_permanent_slice_module` from `@ariadnejs/types` —
 * the same function the generator writes through.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
  parse_known_issues_registry_json,
  render_permanent_slice_module,
} from "@ariadnejs/types";

/**
 * Walk up from this test file to the directory holding `pnpm-workspace.yaml`.
 * Core depends only on `@ariadnejs/types`, so it cannot import
 * skill-protocol's `repo_root()`; the walk is small enough to keep local.
 */
function find_repo_root(): string {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("could not locate repo root (no pnpm-workspace.yaml found)");
    }
    dir = parent;
  }
  return dir;
}

describe("registry_permanent_data.ts sync", () => {
  it("byte-equals a fresh render of the source registry's permanent slice", () => {
    const root = find_repo_root();
    const source_raw = fs.readFileSync(
      path.join(root, ".claude", "skills", "triage", "known_issues", "registry.json"),
      "utf8",
    );
    const committed = fs.readFileSync(
      path.join(root, "packages", "core", "src", "classify_entry_points", "registry_permanent_data.ts"),
      "utf8",
    );
    const fresh = render_permanent_slice_module(
      KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
      parse_known_issues_registry_json(source_raw),
    );
    expect(committed).toEqual(fresh);
  });
});
