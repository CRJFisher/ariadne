import type TreeSitter from "tree-sitter";

/**
 * Process-global loader for tree-sitter and its grammar packages.
 *
 * The native addon initializes once per process, binding to the JavaScript
 * class identities (Tree, Query, marshal buffers) present when
 * `tree-sitter/index.js` is first evaluated. A test runner that gives each
 * test file a fresh module registry — jest, or vitest with `resetModules` —
 * otherwise re-evaluates the wrapper, minting new classes the addon has never
 * seen; marshalling then throws `Cannot read properties of undefined (reading
 * 'tree')` on every parse. Caching each require on `globalThis` lets `??=`
 * skip the re-require in a second registry, so the wrapper is evaluated
 * exactly once per process and every identity stays consistent with the
 * binding. Compiled `Query` objects live in the same store because they hold
 * native language references tied to that single evaluation.
 *
 * tree-sitter's module export IS the Parser class, with Query and Language
 * attached as statics — so `tree_sitter` is re-exported as `Parser` and
 * `tree_sitter.Query` yields the Query class.
 *
 * Every runtime use of tree-sitter and the grammar packages routes through
 * this module, re-exported under the packages' own class names; eslint forbids
 * importing them as values anywhere else in production code (test files build
 * throwaway parsers and are exempt). Types still come straight from
 * `tree-sitter` via `import type`, which is erased at compile time and so never
 * re-requires the wrapper.
 */

type Grammar = TreeSitter.Language;
type TypeScriptGrammar = { typescript: Grammar; tsx: Grammar };

interface NativeCache {
  tree_sitter: typeof import("tree-sitter");
  javascript: Grammar;
  python: Grammar;
  rust: Grammar;
  typescript: TypeScriptGrammar;
  // Keyed by query dialect: the language name, or "typescript:tsx" for the
  // JSX-augmented TypeScript query compiled against the tsx grammar.
  compiled_queries: Map<string, TreeSitter.Query>;
}

// One leading underscore (not two) so the internal global key satisfies the
// naming-convention lint while still reading as private.
const cache = ((globalThis as { _ariadne_native?: Partial<NativeCache> })
  ._ariadne_native ??= {});

const tree_sitter = (cache.tree_sitter ??=
  require("tree-sitter") as typeof import("tree-sitter"));
const query = tree_sitter.Query;
const javascript = (cache.javascript ??=
  require("tree-sitter-javascript") as Grammar);
const python = (cache.python ??= require("tree-sitter-python") as Grammar);
const rust = (cache.rust ??= require("tree-sitter-rust") as Grammar);
const typescript = (cache.typescript ??=
  require("tree-sitter-typescript") as TypeScriptGrammar);

/**
 * Per-language compiled `Query` cache. Compilation is expensive (~100ms per
 * language) and the query is identical for all files of a language, so it is
 * memoized in the process-global store alongside the grammars it binds.
 */
const compiled_query_cache = (cache.compiled_queries ??= new Map<
  string,
  TreeSitter.Query
>());

export {
  tree_sitter as Parser,
  query as Query,
  javascript as JavaScript,
  python as Python,
  rust as Rust,
  typescript as TypeScript,
  compiled_query_cache as COMPILED_QUERY_CACHE,
};
