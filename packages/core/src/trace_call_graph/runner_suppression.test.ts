import { describe, it, expect } from "vitest";
import { is_runner_invoked_callable } from "./runner_suppression";
import {
  function_symbol,
  method_symbol,
  decorator_symbol,
} from "@ariadnejs/types";
import type {
  FunctionDefinition,
  MethodDefinition,
  DecoratorDefinition,
  FilePath,
  Language,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";

const rust_file = "src/foo.rs" as FilePath;
const root_scope = "scope:src/foo.rs:module" as ScopeId;

function loc(file_path: FilePath): Location {
  return {
    file_path,
    start_line: 1,
    start_column: 0,
    end_line: 1,
    end_column: 1,
  };
}

function decorator(name: string, file_path: FilePath): DecoratorDefinition {
  const location = loc(file_path);
  return {
    kind: "decorator",
    symbol_id: decorator_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: root_scope,
    location,
  };
}

function rust_function(
  name: string,
  decorators: DecoratorDefinition[]
): FunctionDefinition {
  const location = loc(rust_file);
  return {
    kind: "function",
    symbol_id: function_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: root_scope,
    location,
    is_exported: false,
    signature: { parameters: [] },
    body_scope_id: "scope:src/foo.rs:fn" as ScopeId,
    decorators,
  };
}

function python_method(name: string, file_path: FilePath): MethodDefinition {
  const location = loc(file_path);
  return {
    kind: "method",
    symbol_id: method_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: `scope:${file_path}:class` as ScopeId,
    location,
    parameters: [],
    body_scope_id: `scope:${file_path}:method` as ScopeId,
  };
}

describe("is_runner_invoked_callable", () => {
  describe("rust test-harness attributes", () => {
    it("suppresses a #[test] function", () => {
      const def = rust_function("top_level_test", [
        decorator("test", rust_file),
      ]);
      expect(is_runner_invoked_callable(def, rust_file, "rust" as Language)).toBe(
        true
      );
    });

    it("suppresses a #[cfg(test)]-gated function (recorded as a cfg decorator)", () => {
      const def = rust_function("build_fixture", [decorator("cfg", rust_file)]);
      expect(is_runner_invoked_callable(def, rust_file, "rust" as Language)).toBe(
        true
      );
    });

    it("retains a function with no test-harness decorators", () => {
      const def = rust_function("run_server", []);
      expect(is_runner_invoked_callable(def, rust_file, "rust" as Language)).toBe(
        false
      );
    });
  });

  describe("python ASV benchmark methods", () => {
    const asv_file =
      "asv_bench/benchmarks/frame_ctor.py" as FilePath;

    it("suppresses a time_* method under asv_bench/benchmarks", () => {
      const def = python_method("time_nested_dict", asv_file);
      expect(
        is_runner_invoked_callable(def, asv_file, "python" as Language)
      ).toBe(true);
    });

    it("suppresses mem_ and peakmem_ prefixed methods", () => {
      expect(
        is_runner_invoked_callable(
          python_method("mem_frame", asv_file),
          asv_file,
          "python" as Language
        )
      ).toBe(true);
      expect(
        is_runner_invoked_callable(
          python_method("peakmem_frame", asv_file),
          asv_file,
          "python" as Language
        )
      ).toBe(true);
    });

    it("retains a time_* method outside asv_bench/benchmarks", () => {
      const regular = "src/stopwatch.py" as FilePath;
      const def = python_method("time_elapsed", regular);
      expect(
        is_runner_invoked_callable(def, regular, "python" as Language)
      ).toBe(false);
    });

    it("retains a non-benchmark-prefixed method under asv_bench/benchmarks", () => {
      const def = python_method("setup", asv_file);
      expect(
        is_runner_invoked_callable(def, asv_file, "python" as Language)
      ).toBe(false);
    });
  });

  it("does not suppress callables in languages without runner conventions", () => {
    const ts_file = "src/foo.ts" as FilePath;
    const def: FunctionDefinition = {
      kind: "function",
      symbol_id: function_symbol("time_thing" as SymbolName, loc(ts_file)),
      name: "time_thing" as SymbolName,
      defining_scope_id: "scope:src/foo.ts:module" as ScopeId,
      location: loc(ts_file),
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: "scope:src/foo.ts:fn" as ScopeId,
    };
    expect(
      is_runner_invoked_callable(def, ts_file, "typescript" as Language)
    ).toBe(false);
  });
});
