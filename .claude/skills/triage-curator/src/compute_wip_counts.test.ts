import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { compute_wip_group_counts } from "./compute_wip_counts.js";
import type { KnownIssue, KnownIssueExample } from "./types.js";

let tmp_dir: string;
let registry_path: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "wip-counts-"));
  registry_path = path.join(tmp_dir, "registry.json");
});

afterEach(async () => {
  await fs.rm(tmp_dir, { recursive: true, force: true });
});

function example(i: number): KnownIssueExample {
  return { file: `f${i}.ts`, line: i, snippet: `line ${i}` };
}

function entry(overrides: Partial<KnownIssue>): KnownIssue {
  return {
    group_id: "g",
    title: "g",
    description: "",
    status: "wip",
    languages: [],
    examples: [],
    classifier: { kind: "none" },
    ...overrides,
  };
}

async function write_registry(entries: KnownIssue[]): Promise<void> {
  await fs.writeFile(registry_path, JSON.stringify(entries), "utf8");
}

describe("compute_wip_group_counts", () => {
  it("returns {} for an empty registry", async () => {
    await write_registry([]);
    expect(await compute_wip_group_counts(registry_path)).toEqual({});
  });

  it("counts examples.length for wip entries", async () => {
    await write_registry([
      entry({ group_id: "a", status: "wip", examples: [example(1), example(2)] }),
      entry({ group_id: "b", status: "wip", examples: [] }),
    ]);
    expect(await compute_wip_group_counts(registry_path)).toEqual({ a: 2, b: 0 });
  });

  it("skips permanent and fixed entries", async () => {
    await write_registry([
      entry({ group_id: "keep", status: "wip", examples: [example(1)] }),
      entry({ group_id: "perm", status: "permanent", examples: [example(1), example(2)] }),
      entry({ group_id: "done", status: "fixed", examples: [example(1)] }),
    ]);
    expect(await compute_wip_group_counts(registry_path)).toEqual({ keep: 1 });
  });

  it("last writer wins on duplicate group_id (defensive, registry validates uniqueness)", async () => {
    await write_registry([
      entry({ group_id: "a", status: "wip", examples: [example(1)] }),
      entry({ group_id: "a", status: "wip", examples: [example(1), example(2), example(3)] }),
    ]);
    expect(await compute_wip_group_counts(registry_path)).toEqual({ a: 3 });
  });

  it("throws when registry file does not exist", async () => {
    await expect(
      compute_wip_group_counts(path.join(tmp_dir, "missing.json")),
    ).rejects.toThrow();
  });
});
