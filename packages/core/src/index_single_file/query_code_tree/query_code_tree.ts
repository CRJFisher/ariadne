import type { Language } from "@ariadnejs/types";
import type { Tree, QueryCapture, Query as TreeSitterQuery } from "tree-sitter";
import { Query, COMPILED_QUERY_CACHE } from "../../native";
import { load_query, query_dialect } from "./query_loader";
import { grammar_for_dialect, is_tsx_file } from "./parsers";

/**
 * Get or compile a Query for the given language dialect.
 * Returns cached Query if available, otherwise compiles and caches. The `.tsx`
 * dialect compiles the JSX-augmented query against the tsx grammar; every other
 * file uses the bare language grammar and query.
 */
function get_compiled_query(lang: Language, tsx: boolean): TreeSitterQuery {
  const dialect = query_dialect(lang, tsx);
  const cached = COMPILED_QUERY_CACHE.get(dialect);
  if (cached) {
    return cached;
  }

  const query_string = load_query(lang, tsx);
  const query = new Query(grammar_for_dialect(lang, tsx), query_string);

  COMPILED_QUERY_CACHE.set(dialect, query);
  return query;
}

/**
 * Every capture the language's query makes in `tree`, in document order.
 * `file_path` selects the tsx dialect for a `.tsx` file, so the query compiled
 * matches the grammar the tree was parsed with; omitting it uses the base
 * language query (callers that parse raw `.ts`/`.js` snippets need no path).
 *
 * Captures are read off `query.matches()`, which hands over each match as it
 * completes. `query.captures()` would return document order directly, but it
 * holds every completed match back while any earlier-starting match is still
 * open, and a file written as one wrapper (a UMD bundle, an IIFE module) keeps
 * a match open across its whole length. tree-sitter numbers held matches with
 * 16-bit ids, so past 65,535 of them the process dies with SIGSEGV; below
 * that, finding the earliest open match rescans all of them, so time grows
 * quadratically with the number held.
 *
 * Document order is restored by sorting on start byte, then on pattern index,
 * the keys `captures()` orders by. The sort is stable, so captures tied on
 * both keep the order their matches completed in, and a match's own captures
 * keep the order its pattern makes them.
 */
export function query_tree(
  lang: Language,
  tree: Tree,
  file_path?: string
): QueryCapture[] {
  const tsx = file_path !== undefined && is_tsx_file(lang, file_path);
  const query = get_compiled_query(lang, tsx);

  const positioned: PositionedCapture[] = [];
  for (const match of query.matches(tree.rootNode)) {
    for (const capture of match.captures) {
      positioned.push({
        capture,
        start: capture.node.startIndex,
        pattern: match.pattern,
      });
    }
  }
  positioned.sort((a, b) => a.start - b.start || a.pattern - b.pattern);
  return positioned.map(({ capture }) => capture);
}

/**
 * A capture with its sort keys read once: a node's start byte is a crossing
 * into the binding, which a comparator would otherwise pay on every comparison.
 */
interface PositionedCapture {
  readonly capture: QueryCapture;
  readonly start: number;
  readonly pattern: number;
}
