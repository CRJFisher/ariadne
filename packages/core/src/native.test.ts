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
    const store = native_store();

    expect(store).toBeDefined();
    expect(Parser).toBe(store.tree_sitter);
    expect(Query).toBe(store.tree_sitter.Query);
    expect(JavaScript).toBe(store.javascript);
    expect(Python).toBe(store.python);
    expect(Rust).toBe(store.rust);
    expect(TypeScript).toBe(store.typescript);
    expect(COMPILED_QUERY_CACHE).toBe(store.compiled_queries);
  });

  it("re-obtaining tree-sitter via the store is idempotent", () => {
    const cache = native_store();
    // A second registry re-runs the loader's `??=`; against the populated
    // store it returns the first evaluation's objects untouched.
    const reobtained = (cache.tree_sitter ??= Parser);
    expect(reobtained).toBe(Parser);
    expect(reobtained.Query).toBe(Query);
  });

  it("marshals captures across two independent parses sharing one compiled query", () => {
    const first = query_tree("javascript", parse(JavaScript, "const a = 1;"));
    const cached_query = COMPILED_QUERY_CACHE.get("javascript" as Language);
    const second = query_tree(
      "javascript",
      parse(JavaScript, "function b() { return 2; }")
    );

    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    // The compiled Query is cached once and reused for the second parse — the
    // native language reference stays valid across marshalling calls.
    expect(cached_query).toBe(COMPILED_QUERY_CACHE.get("javascript" as Language));
  });
});
