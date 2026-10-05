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
 * Query tree and get raw captures.
 * `file_path` selects the tsx dialect for a `.tsx` file, so the query compiled
 * matches the grammar the tree was parsed with; omitting it uses the base
 * language query (callers that parse raw `.ts`/`.js` snippets need no path).
 */
export function query_tree(
  lang: Language,
  tree: Tree,
  file_path?: string
): QueryCapture[] {
  const tsx = file_path !== undefined && is_tsx_file(lang, file_path);
  const query = get_compiled_query(lang, tsx);
  return query.captures(tree.rootNode);
}
