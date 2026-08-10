import { describe, it, expect } from "vitest";

import type {
  EnrichedEntryPoint,
  FilePath,
  GrepHit,
  Language,
} from "@ariadnejs/types";
import { check_py_functional_property_accessor } from "./check_py-functional-property-accessor";

const CALLER_FILE = "/repo/src/models.py" as FilePath;
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
    name: overrides.name ?? "_get_request",
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
      grep_call_sites_outside_index: [],
      reference_sites: [],
      ariadne_call_refs: [],
      diagnosis: "callers-in-registry-unresolved",
      has_uncaptured_indexed_grep_hit: false,
    },
  };
}

function run(entry: EnrichedEntryPoint, language: Language): boolean {
  return check_py_functional_property_accessor(entry, EMPTY_READER, language);
}

describe("check_py_functional_property_accessor", () => {
  it("matches a single-fget accessor passed to property() (entry 977)", () => {
    const entry = make_entry({
      name: "_get_request",
      grep_lines: ["    request = property(_get_request)"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches an fget accessor in a two-argument property() call (entry 3439)", () => {
    const entry = make_entry({
      name: "_get_post",
      grep_lines: ["    POST = property(_get_post, _set_post)"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches the fset accessor in the second argument position (entry 3441)", () => {
    const entry = make_entry({
      name: "_set_post",
      grep_lines: ["    POST = property(_get_post, _set_post)"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches an accessor whose name shares a prefix with the attribute (entry 3469)", () => {
    const entry = make_entry({
      name: "_get_spatial_filter",
      grep_lines: [
        "    spatial_filter = property(_get_spatial_filter, _set_spatial_filter)",
      ],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches an fget-only accessor named after its attribute (entry 3599)", () => {
    const entry = make_entry({
      name: "_get_media",
      grep_lines: ["    media = property(_get_media)"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches the fget= keyword-argument form", () => {
    const entry = make_entry({
      name: "_get_name",
      grep_lines: ["    name = property(fget=_get_name, fset=_set_name)"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("does not match an uncalled method whose name is absent from the property() args", () => {
    const entry = make_entry({
      name: "_get_widget",
      grep_lines: ["    POST = property(_get_post, _set_post)"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match when the entry name is a substring of an accessor arg", () => {
    const entry = make_entry({
      name: "_get_post",
      grep_lines: ["    POST_META = property(_get_post_meta, _set_post_meta)"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match a decorator-form property, which the sibling classifier owns", () => {
    const entry = make_entry({
      name: "full_name",
      grep_lines: ["    return f'{obj.full_name}'"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match a same-named method invoked as a receiver's .property() call", () => {
    const entry = make_entry({
      name: "_get_request",
      grep_lines: ["    view.property(_get_request)"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match a substring collision on a user-defined my_property() call", () => {
    const entry = make_entry({
      name: "_get_request",
      grep_lines: ["    request = my_property(_get_request)"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match an ordinary resolvable call to the accessor", () => {
    const entry = make_entry({
      name: "_get_request",
      grep_lines: ["    value = self._get_request()"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match a non-python entry even with a matching property() line", () => {
    const entry = make_entry({
      name: "_get_request",
      grep_lines: ["    request = property(_get_request)"],
    });
    expect(run(entry, "typescript")).toBe(false);
  });
});
