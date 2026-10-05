import { describe, it, expect } from "vitest";

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import { check_dynamic_dispatch } from "./check_dynamic-dispatch";

const EMPTY_READER = (_: string) => [] as readonly string[];

function make_entry(overrides: {
  name?: string;
  file_path?: string;
  kind?: EnrichedEntryPoint["kind"];
} = {}): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "apply",
    file_path: (overrides.file_path ??
      "/repo/webpack/lib/dependencies/HarmonyImportDependency.js") as FilePath,
    start_line: 42,
    kind: overrides.kind ?? "method",
    tree_size: 0,
    is_exported: true,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_outside_index: [],
      reference_sites: [],
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
      has_uncaptured_indexed_grep_hit: false,
    },
  };
}

describe("check_dynamic_dispatch", () => {
  // Positive: the constructor-keyed Map dispatch this rule names —
  // dependencyTemplates.get(constructor).apply(...) picks the callee at runtime,
  // so an `apply` method under lib/dependencies/ has no static call site.
  it("matches a JavaScript apply method under lib/dependencies", () => {
    expect(check_dynamic_dispatch(make_entry(), EMPTY_READER, "javascript")).toBe(true);
  });

  // Negative guard — precision. A genuine true-positive with an ordinary static
  // call site: an `apply` method outside lib/dependencies (e.g. the
  // ObjectMiddleware/ClassSerializer serialize()-style dispatch this rule
  // deliberately excludes) is a real finding and must not be suppressed.
  it("does not match an apply method outside lib/dependencies", () => {
    const entry = make_entry({ file_path: "/repo/webpack/lib/serialization/ObjectMiddleware.js" });
    expect(check_dynamic_dispatch(entry, EMPTY_READER, "javascript")).toBe(false);
  });

  // Negative guard — the drift excerpt (entry 2548) is a DIFFERENT limitation:
  //   const Plugin = evalWrapped ? require('./EvalSourceMapDevToolPlugin')
  //                              : require('./SourceMapDevToolPlugin'); new Plugin({...})
  // The unreachable entry is a plugin *constructor* bound to a local from a
  // conditional require() ternary — not the dependencyTemplates Map. It carries
  // neither the `apply` name nor the lib/dependencies/ path, so this rule
  // correctly returns false. Capturing it belongs to a new classifier, not a
  // broadening of this one.
  it("does not match a conditionally-required plugin constructor (drift entry 2548 is a different pattern)", () => {
    const entry = make_entry({
      name: "EvalSourceMapDevToolPlugin",
      file_path: "/repo/webpack/lib/EvalSourceMapDevToolPlugin.js",
      kind: "constructor",
    });
    expect(check_dynamic_dispatch(entry, EMPTY_READER, "javascript")).toBe(false);
  });

  it("does not match a non-JavaScript entry point", () => {
    expect(check_dynamic_dispatch(make_entry(), EMPTY_READER, "typescript")).toBe(false);
  });

  it("does not match a non-apply method under lib/dependencies", () => {
    const entry = make_entry({ name: "serialize" });
    expect(check_dynamic_dispatch(entry, EMPTY_READER, "javascript")).toBe(false);
  });
});
