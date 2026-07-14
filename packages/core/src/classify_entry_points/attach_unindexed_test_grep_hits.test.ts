import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import { attach_unindexed_test_grep_hits } from "./attach_unindexed_test_grep_hits";

describe("attach_unindexed_test_grep_hits", () => {
  it("sets callers_only_in_unindexed_tests when callers live only in excluded test dirs", async () => {
    // The coverage-gap shape: an entry with no indexed callers (grep_call_sites
    // empty) whose only callers are in a directory excluded from indexing. The
    // unindexed-test grep pass must flip the flag — this is what `derive_fault_area`
    // routes to `coverage_config`.
    const root = await mkdtemp(join(tmpdir(), "ariadne-coverage-"));
    await mkdir(join(root, "tests"), { recursive: true });
    await writeFile(join(root, "tests", "lib.test.ts"), "orphan();\n", "utf8");

    const entry: EnrichedEntryPoint = {
      name: "orphan",
      file_path: join(root, "lib.ts") as FilePath,
      start_line: 1,
      kind: "function",
      tree_size: 1,
      is_exported: true,
      definition_features: {
        definition_is_object_literal_method: false,
        accessor_kind: null,
      },
      diagnostics: {
        grep_call_sites: [],
        grep_call_sites_unindexed_tests: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
        has_uncaptured_indexed_grep_hit: false,
        callers_only_in_unindexed_tests: false,
      },
    };

    // indexed_source_files is empty, so the test file is "unindexed".
    await attach_unindexed_test_grep_hits([entry], root, new Map(), new Map(), []);

    expect(entry.diagnostics.callers_only_in_unindexed_tests).toEqual(true);
    expect(entry.diagnostics.grep_call_sites_unindexed_tests.length).toEqual(1);
    expect(entry.diagnostics.grep_call_sites_unindexed_tests[0].content).toEqual("orphan();");
  });
});
