import type { Language, FilePath } from "@ariadnejs/types";
import { type Tree, Query, type QueryCapture } from "tree-sitter";
import { load_query, LANGUAGE_TO_TREESITTER_LANG } from "./query_loader";

/**
 * Query tree and get raw captures
 * Returns raw tree-sitter captures for processing
 */
export function query_tree_and_parse_captures(
  lang: Language,
  tree: Tree,
  file_path: FilePath
): QueryCapture[] {
  const query_string = load_query(lang);
  const parser = LANGUAGE_TO_TREESITTER_LANG.get(lang);
  if (!parser) {
    throw new Error(`No tree-sitter parser found for language: ${lang}`);
  }
  const query = new Query(parser, query_string);
  const captures = query.captures(tree.rootNode);

  // Return raw captures directly
  return captures;
}
