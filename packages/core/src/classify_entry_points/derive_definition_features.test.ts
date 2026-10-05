import { describe, it, expect } from "vitest";
import { derive_definition_features } from "./derive_definition_features";
import type {
  AnyDefinition,
  CallableNode,
  SymbolId,
  SymbolName,
  ScopeId,
  FilePath,
} from "@ariadnejs/types";

const sym = (s: string) => s as SymbolId;
const name = (s: string) => s as SymbolName;
const scope = (s: string) => s as ScopeId;
const fp = (s: string) => s as FilePath;

function make_node(
  overrides: {
    name?: string;
    symbol_id?: string;
    file_path?: string;
    start_line?: number;
    kind?: "function" | "method" | "constructor";
  } = {},
): CallableNode {
  const node_name = overrides.name ?? "fn";
  const file_path = overrides.file_path ?? "src/test.ts";
  const start_line = overrides.start_line ?? 1;
  const kind = overrides.kind ?? "function";
  return {
    symbol_id: sym(overrides.symbol_id ?? "fn_id"),
    name: name(node_name),
    location: {
      file_path: fp(file_path),
      start_line,
      start_column: 0,
      end_line: start_line + 2,
      end_column: 1,
    },
    definition: {
      kind,
      name: name(node_name),
      body_scope_id: scope("scope_1"),
    } as object as AnyDefinition,
    enclosed_calls: [],
    is_test: false,
  };
}

describe("derive_definition_features", () => {
  it("returns the neutral record for non-JS/TS files", () => {
    const node = make_node({ file_path: "src/main.py", kind: "method" });
    const out = derive_definition_features(node, new Set(), new Map(), "python");
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: null,
    });
  });

  it("returns the neutral record for Rust files", () => {
    const node = make_node({ file_path: "src/main.rs", kind: "function" });
    const out = derive_definition_features(node, new Set(), new Map(), "rust");
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: null,
    });
  });

  it("flags an object-literal-method (kind=method but not in class_methods set)", () => {
    const node = make_node({
      file_path: "src/o.ts",
      symbol_id: "obj_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<FilePath, string[]>([
      [fp("src/o.ts"), ["const o = {", "  foo() { return 1; },", "};"]],
    ]);
    const out = derive_definition_features(node, new Set(), lines, "typescript");
    expect(out).toEqual({
      definition_is_object_literal_method: true,
      accessor_kind: null,
    });
  });

  it("does NOT flag a class method whose symbol_id is in class_methods", () => {
    const node = make_node({
      file_path: "src/c.ts",
      symbol_id: "class_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<FilePath, string[]>([
      [fp("src/c.ts"), ["class C {", "  foo() {}", "}"]],
    ]);
    const class_methods = new Set<SymbolId>([sym("class_method")]);
    const out = derive_definition_features(node, class_methods, lines, "typescript");
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: null,
    });
  });

  it("does NOT flag a standalone function (kind=function)", () => {
    const node = make_node({
      file_path: "src/f.ts",
      kind: "function",
      start_line: 1,
    });
    const lines = new Map<FilePath, string[]>([
      [fp("src/f.ts"), ["function foo() {", "  return 1;", "}"]],
    ]);
    const out = derive_definition_features(node, new Set(), lines, "typescript");
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: null,
    });
  });

  it("routes JavaScript entries through the jsts leaf", () => {
    const node = make_node({
      file_path: "src/o.js",
      symbol_id: "obj_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<FilePath, string[]>([
      [fp("src/o.js"), ["const o = {", "  get name() { return this._n; },", "};"]],
    ]);
    const out = derive_definition_features(node, new Set(), lines, "javascript");
    expect(out).toEqual({
      definition_is_object_literal_method: true,
      accessor_kind: "getter",
    });
  });

  it("captures accessor_kind for a class getter", () => {
    const node = make_node({
      file_path: "src/c.ts",
      symbol_id: "class_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<FilePath, string[]>([
      [fp("src/c.ts"), ["class C {", "  get name() { return this._n; }", "}"]],
    ]);
    const class_methods = new Set<SymbolId>([sym("class_method")]);
    const out = derive_definition_features(node, class_methods, lines, "typescript");
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: "getter",
    });
  });

  it("captures accessor_kind for a class setter", () => {
    const node = make_node({
      file_path: "src/c.ts",
      symbol_id: "class_method",
      kind: "method",
      start_line: 2,
    });
    const lines = new Map<FilePath, string[]>([
      [fp("src/c.ts"), ["class C {", "  set name(v: string) { this._n = v; }", "}"]],
    ]);
    const class_methods = new Set<SymbolId>([sym("class_method")]);
    const out = derive_definition_features(node, class_methods, lines, "typescript");
    expect(out).toEqual({
      definition_is_object_literal_method: false,
      accessor_kind: "setter",
    });
  });
});
