import { describe, it, expect } from "vitest";

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { check_py_property_decorator_access } from "./check_py-property-decorator-access";

const PY_FILE = "/repo/src/model.py" as FilePath;

function reader_for(lines: readonly string[]): FileLinesReader {
  return (_: string) => lines;
}

function make_entry(overrides: {
  file_path?: FilePath;
  start_line?: number;
} = {}): EnrichedEntryPoint {
  return {
    name: "value",
    file_path: overrides.file_path ?? PY_FILE,
    start_line: overrides.start_line ?? 3,
    kind: "method",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "callers-in-registry-unresolved",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
  };
}

describe("check_py_property_decorator_access", () => {
  it("matches a builtin @property getter accessed as an attribute", () => {
    const lines = [
      "class Model:",
      "    @property",
      "    def full_name(self):",
      "        return f'{self.first} {self.last}'",
    ];
    expect(check_py_property_decorator_access(make_entry(), reader_for(lines), "python")).toBe(true);
  });

  it("matches a @cached_property getter", () => {
    const lines = [
      "class App:",
      "    @cached_property",
      "    def graph(self):",
      "        return self.build_graph()",
    ];
    expect(check_py_property_decorator_access(make_entry(), reader_for(lines), "python")).toBe(true);
  });

  it("matches a pandas @cache_readonly descriptor", () => {
    const lines = [
      "class Grouping:",
      "    @cache_readonly",
      "    def _observed_grouping(self) -> Grouping:",
      "        return self._grouping",
    ];
    expect(check_py_property_decorator_access(make_entry(), reader_for(lines), "python")).toBe(true);
  });

  it("matches a class-level @classproperty descriptor", () => {
    const lines = [
      "class Migrator:",
      "    @classproperty",
      "    def Migration(cls):",
      "        return cls._migration_class",
    ];
    expect(check_py_property_decorator_access(make_entry(), reader_for(lines), "python")).toBe(true);
  });

  it("matches a module-prefixed @functools.cached_property decorator", () => {
    const lines = [
      "class Cfg:",
      "    @functools.cached_property",
      "    def value(self):",
      "        return compute()",
    ];
    expect(check_py_property_decorator_access(make_entry(), reader_for(lines), "python")).toBe(true);
  });

  it("does not match an ordinary uncalled method with no decorator", () => {
    const lines = [
      "class Foo:",
      "    def helper(self):",
      "        return 1",
    ];
    expect(
      check_py_property_decorator_access(make_entry({ start_line: 2 }), reader_for(lines), "python"),
    ).toBe(false);
  });

  it("does not match a @staticmethod-decorated uncalled method", () => {
    const lines = [
      "class Foo:",
      "    @staticmethod",
      "    def helper():",
      "        return 1",
    ];
    expect(check_py_property_decorator_access(make_entry(), reader_for(lines), "python")).toBe(false);
  });

  // Memoization decorators keep call syntax (`obj.compute()`), so an uncalled one
  // is a genuine finding — the predicate must stay precise against `cache_readonly`.
  it("does not match a @cache memoization decorator", () => {
    const lines = [
      "class Foo:",
      "    @cache",
      "    def compute(self):",
      "        return heavy()",
    ];
    expect(check_py_property_decorator_access(make_entry(), reader_for(lines), "python")).toBe(false);
  });

  // The functional `property(...)` form is a separate, un-captured limitation: its
  // accessor function carries no decorator for the decorator-block to find.
  it("does not match the accessor of a functional property() assignment", () => {
    const lines = [
      "class Request:",
      "    def _get_request(self):",
      "        return self._request",
      "    request = property(_get_request)",
    ];
    expect(
      check_py_property_decorator_access(make_entry({ start_line: 2 }), reader_for(lines), "python"),
    ).toBe(false);
  });

  it("does not match a non-Python entry point", () => {
    const lines = [
      "class Model {",
      "    @property",
      "    full_name() {}",
    ];
    expect(
      check_py_property_decorator_access(
        make_entry({ file_path: "/repo/src/model.ts" as FilePath }),
        reader_for(lines),
        "typescript",
      ),
    ).toBe(false);
  });
});
