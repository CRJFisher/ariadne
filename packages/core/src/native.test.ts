import { describe, it, expect } from "vitest";
import type TreeSitter from "tree-sitter";
import type { Language } from "@ariadnejs/types";
import {
  Parser,
  Query,
  JavaScript,
  Python,
  Rust,
  TypeScript,
  COMPILED_QUERY_CACHE,
} from "./native";
import { query_tree } from "./index_single_file/query_code_tree/query_code_tree";

// Deliberately re-derived from the public exports rather than imported from
// native.ts: the test asserts the store's shape independently, so a change to
// the loader's own type cannot silently move the goalposts.
interface NativeStore {
  tree_sitter: typeof Parser;
  javascript: typeof JavaScript;
  python: typeof Python;
  rust: typeof Rust;
  typescript: typeof TypeScript;
  compiled_queries: typeof COMPILED_QUERY_CACHE;
}

function native_store(): NativeStore {
  const store = (globalThis as { _ariadne_native?: NativeStore })
    ._ariadne_native;
  if (!store) {
    throw new Error("native loader did not populate the process-global store");
  }
  return store;
}

function parse(grammar: TreeSitter.Language, code: string): TreeSitter.Tree {
  const parser = new Parser();
  parser.setLanguage(grammar);
  return parser.parse(code);
}

// The full cross-registry reproduction — two jest module registries in one
// worker both parsing — lives in code-charter's `packages/drift` suite
// (TASK-363 AC #4), which consumes the released package. It cannot run inside
// Ariadne's own vitest: `vi.resetModules()` does not clear Node's CJS require
// cache (which backs the native addon), and dynamic `import()` is banned by
// eslint, so a second evaluation of the wrapper is not reachable here. These
// tests instead lock the invariant that makes the crash impossible: every
// runtime tree-sitter identity is owned by one `globalThis` store, so a
// re-evaluated registry reuses it rather than minting rival classes.
describe("native loader", () => {
  it("owns every tree-sitter and grammar identity in one process-global store", () => {
    // Reverting the loader to a plain `require("tree-sitter")` leaves the store
    // unpopulated, so native_store() throws and this test fails — its teeth
    // against the regression are exactly the presence of the global cache.
    const store = native_store();

    expect(Parser).toBe(store.tree_sitter);
    expect(Query).toBe(store.tree_sitter.Query);
    expect(JavaScript).toBe(store.javascript);
    expect(Python).toBe(store.python);
    expect(Rust).toBe(store.rust);
    expect(TypeScript).toBe(store.typescript);
    expect(COMPILED_QUERY_CACHE).toBe(store.compiled_queries);
  });

  it("marshals the exact captures across two parses sharing one compiled query", () => {
    const first = query_tree("javascript", parse(JavaScript, "const a = 1;"));
    const cached_query = COMPILED_QUERY_CACHE.get("javascript" as Language);
    const second = query_tree(
      "javascript",
      parse(JavaScript, "function b() { return 2; }")
    );

    // Both parses marshal (the crash path is Query.captures) and return the
    // exact captures for the fixtures — proving the native binding produced
    // correct data, not merely non-empty data.
    expect(first.map((c) => c.name)).toEqual([
      "scope.module",
      "assignment.variable",
      "definition.variable",
      "assignment.variable",
      "reference.variable",
      "reference.variable",
    ]);
    expect(second.map((c) => c.name)).toEqual([
      "scope.module",
      "scope.function",
      "definition.function",
      "reference.variable",
      "return.function",
      "return.variable",
    ]);
    // The compiled Query is cached once and reused for the second parse.
    expect(cached_query).toBe(COMPILED_QUERY_CACHE.get("javascript" as Language));
  });
});
