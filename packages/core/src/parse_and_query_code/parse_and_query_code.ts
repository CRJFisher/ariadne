import type { Language, FilePath } from "@ariadnejs/types";
import { type Tree, Query } from "tree-sitter";
import {
  normalize_captures,
  group_captures_by_category,
} from "./capture_normalizer";
import { load_query, LANGUAGE_TO_TREESITTER_LANG } from "./query_loader";

/**
 * Query tree and parse captures into normalized semantic categories
 * Returns grouped normalized captures for testing and use
 */
export function query_tree_and_parse_captures(
  lang: Language,
  tree: Tree,
  file_path: FilePath
) {
  const query_string = load_query(lang);
  const parser = LANGUAGE_TO_TREESITTER_LANG.get(lang);
  if (!parser) {
    throw new Error(`No tree-sitter parser found for language: ${lang}`);
  }
  const query = new Query(parser, query_string);
  const captures = query.captures(tree.rootNode);

  // Normalize captures to common semantic format
  const normalized = normalize_captures(captures, lang, file_path);

  // Group by category and return
  return group_captures_by_category(normalized);
}
