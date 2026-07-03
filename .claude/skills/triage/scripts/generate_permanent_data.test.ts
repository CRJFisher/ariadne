/**
 * I/O tests for `generate_permanent_data` against a temp source registry and
 * temp output path. The render itself (filtering, byte format, determinism)
 * is covered in `@ariadnejs/types`' `known_issues.test.ts`; here we assert the
 * read → render → write half: what lands on disk, the `changed` flag, and
 * that `--dry-run` writes nothing.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { KnownIssue } from "@ariadnejs/types";
import {
  KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
  render_permanent_slice_module,
  serialize_known_issues_registry_json,
} from "@ariadnejs/types";

import { generate_permanent_data } from "./generate_permanent_data.js";

const permanent_rule: KnownIssue = {
  group_id: "bundled-rule",
  title: "Bundled rule",
  description: "Permanent with a real classifier; belongs in the slice.",
  status: "permanent",
  languages: ["typescript"],
  examples: [],
  classifier: {
    function_name: "check_bundled_rule",
    min_confidence: 1,
  },
};

const wip_rule: KnownIssue = {
  group_id: "wip-rule",
  title: "Wip rule",
  description: "Not permanent; dropped from the slice.",
  status: "wip",
  languages: ["python"],
  examples: [],
  classifier: { function_name: "check_wip_rule", min_confidence: 1 },
};

describe("generate_permanent_data", () => {
  let tmp_dir: string;
  let source_path: string;
  let output_path: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "generate-permanent-"));
    source_path = path.join(tmp_dir, "source.json");
    output_path = path.join(tmp_dir, "permanent_data.ts");
    await fs.writeFile(
      source_path,
      serialize_known_issues_registry_json([permanent_rule, wip_rule]),
    );
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  it("writes the rendered permanent slice and reports changed", async () => {
    const summary = await generate_permanent_data({
      dry_run: false,
      source_registry_path: source_path,
      output_path,
    });
    expect(summary).toEqual({ dry_run: false, output_path, changed: true });
    const written = await fs.readFile(output_path, "utf8");
    expect(written).toEqual(
      render_permanent_slice_module(KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, [
        permanent_rule,
      ]),
    );
  });

  it("reports changed: false and rewrites nothing when the slice is current", async () => {
    await generate_permanent_data({
      dry_run: false,
      source_registry_path: source_path,
      output_path,
    });
    const before = await fs.stat(output_path);
    const summary = await generate_permanent_data({
      dry_run: false,
      source_registry_path: source_path,
      output_path,
    });
    const after = await fs.stat(output_path);
    expect(summary).toEqual({ dry_run: false, output_path, changed: false });
    expect(after.mtimeMs).toEqual(before.mtimeMs);
  });

  it("writes nothing under dry_run even when the slice would change", async () => {
    const summary = await generate_permanent_data({
      dry_run: true,
      source_registry_path: source_path,
      output_path,
    });
    expect(summary).toEqual({ dry_run: true, output_path, changed: true });
    await expect(fs.readFile(output_path, "utf8")).rejects.toThrowError();
  });
});
