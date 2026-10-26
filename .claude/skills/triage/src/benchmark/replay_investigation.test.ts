import type { FilePath, KnownIssue } from "@ariadnejs/types";
import { describe, expect, it } from "vitest";

import type { TriageEntry } from "../triage_state_types.js";
import type { BenchmarkCase } from "./load_benchmark_suite.js";
import { replay_payload } from "./replay_investigation.js";

const CONTAINER_CLONE = "/home/node/.ariadne/triage-entrypoints/repos/acme--lib";
const LOCAL_CLONE = "/local/.ariadne/triage-entrypoints/repos/acme--lib";

function make_entry(): TriageEntry {
  return {
    entry_index: 7,
    name: "run",
    file_path: `${CONTAINER_CLONE}/src/a.js` as FilePath,
    start_line: 3,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "callers-not-in-registry",
    known_source: null,
    status: "pending",
    result: null,
    error: null,
    is_exported: true,
    access_modifier: null,
    diagnostics: {
      grep_call_sites: [{ file_path: `${CONTAINER_CLONE}/test/a.test.js` as FilePath, line: 9, content: "run()", captures: [] }],
      grep_call_sites_outside_index: [],
      reference_sites: [],
      has_uncaptured_indexed_grep_hit: true,
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
    },
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    tp_stability_sample: false,
    retry_count: 0,
  };
}

function make_case(entry: TriageEntry): BenchmarkCase {
  return {
    case_id: "acme--lib__run__L3",
    strata: "javascript/stable-tp",
    project: "acme--lib",
    github: "acme/lib",
    commit: "abc1234",
    language: "javascript",
    diagnosis: "callers-not-in-registry",
    member_symbol: { file_path: "src/a.js", name: "run", kind: "function", start_line: 3 },
    entry,
    prior_verdicts: [],
  };
}

const rule = (group_id: string, languages: KnownIssue["languages"]): KnownIssue => ({
  group_id,
  title: group_id,
  description: `${group_id} rule`,
  status: "wip",
  languages,
  examples: [],
  classifier: { function_name: `check_${group_id}`, min_confidence: 1 },
});

describe("replay_payload", () => {
  it("rebases a case recorded on another machine onto the local clone and scopes the rules to its language", () => {
    const js = rule("js-rule", ["javascript"]);
    const payload = replay_payload(make_case(make_entry()), LOCAL_CLONE, [js, rule("py-rule", ["python"])]);

    expect(payload.entry_context.file_path).toEqual(`${LOCAL_CLONE}/src/a.js`);
    expect(payload.entry_context.diagnostics.grep_call_sites[0].file_path).toEqual(`${LOCAL_CLONE}/test/a.test.js`);
    expect(payload.relevant_registry_slice).toEqual([js]);
  });
});
