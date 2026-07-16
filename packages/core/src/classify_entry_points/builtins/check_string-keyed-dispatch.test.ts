import { describe, it, expect } from "vitest";

import type {
  EnrichedEntryPoint,
  FilePath,
  GrepHit,
  Language,
} from "@ariadnejs/types";
import { check_string_keyed_dispatch } from "./check_string-keyed-dispatch";

const CALLER_FILE = "/repo/src/dispatch.ts" as FilePath;
const EMPTY_READER = (_: string) => [] as readonly string[];

function grep_hit(content: string): GrepHit {
  return { file_path: CALLER_FILE, line: 1, content, captures: [] };
}

function make_entry(overrides: {
  name?: string;
  file_path?: FilePath;
  grep_lines?: string[];
} = {}): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "head",
    file_path: overrides.file_path ?? CALLER_FILE,
    start_line: 10,
    kind: "method",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: (overrides.grep_lines ?? []).map(grep_hit),
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "callers-in-registry-unresolved",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
  };
}

function run(entry: EnrichedEntryPoint, language: Language): boolean {
  return check_string_keyed_dispatch(entry, EMPTY_READER, language);
}

describe("check_string_keyed_dispatch", () => {
  it("matches an Angular ɵɵ-instruction defined under /packages/core/src/", () => {
    const entry = make_entry({
      name: "ɵɵelementStart",
      file_path: "/repo/packages/core/src/render3/instructions/element.ts" as FilePath,
    });
    expect(run(entry, "typescript")).toBe(true);
  });

  it("matches a two-step string-map lookup resolving the callee by computed member", () => {
    const entry = make_entry({
      grep_lines: ["const methodName = REQUEST_METHOD_MAP[requestMethod]; const method = target[methodName];"],
    });
    expect(run(entry, "typescript")).toBe(true);
  });

  it("matches a dispatch table indexed by a runtime member key then invoked", () => {
    const entry = make_entry({
      grep_lines: [
        "const fn = (visitEachChildTable as Record<SyntaxKind, VisitEachChildFunction<any> | undefined>)[node.kind]; return fn === undefined ? node : fn(node, visitor);",
      ],
    });
    expect(run(entry, "typescript")).toBe(true);
  });

  it("does not match a string-literal-keyed access, which is statically resolvable", () => {
    const entry = make_entry({ grep_lines: ["const method = handlers[\"submit\"];"] });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match a numeric index, which is statically resolvable", () => {
    const entry = make_entry({ grep_lines: ["const first = steps[0];"] });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match an array literal, which is not a computed index", () => {
    const entry = make_entry({ grep_lines: ["const chain = [beforeInsert];"] });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match an event-bus string subscription passing the callback by reference", () => {
    const entry = make_entry({
      name: "highlightHydrationNodes",
      grep_lines: ["messageBus.on('createHydrationOverlay', inspector.highlightHydrationNodes);"],
    });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match an optional dynamic call on an any-typed receiver", () => {
    const entry = make_entry({
      name: "ɵngControlUpdate",
      grep_lines: ["(inst as any)?.ɵngControlUpdate?.(host)"],
    });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match an ordinary resolvable call site", () => {
    const entry = make_entry({ grep_lines: ["this.head(request, response);"] });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match a non-typescript entry", () => {
    const entry = make_entry({
      grep_lines: ["const method = target[methodName];"],
    });
    expect(run(entry, "python")).toBe(false);
  });
});
