import type { Language } from "@ariadnejs/types";
import { type Tree, Query, type QueryCapture } from "tree-sitter";
import {
  load_query,
  LANGUAGE_TO_TREESITTER_LANG,
} from "./query_loader";

/**
 * Cache for compiled Query objects per language.
 * Query compilation is expensive (~100ms per language), but the query
 * is identical for all files of the same language.
 */
const COMPILED_QUERY_CACHE = new Map<Language, Query>();

/**
 * Get or compile a Query for the given language.
 * Returns cached Query if available, otherwise compiles and caches.
 */
function get_compiled_query(lang: Language): Query {
  const cached = COMPILED_QUERY_CACHE.get(lang);
  if (cached) {
    return cached;
  }

  const query_string = load_query(lang);
  const parser = LANGUAGE_TO_TREESITTER_LANG.get(lang);
  if (!parser) {
    throw new Error(`No tree-sitter parser found for language: ${lang}`);
  }

  const query = new Query(parser, query_string);

  COMPILED_QUERY_CACHE.set(lang, query);
  return query;
}

/**
 * Query tree and get raw captures.
 * Returns raw tree-sitter captures for processing.
 */
export function query_tree(lang: Language, tree: Tree): QueryCapture[] {
  const query = get_compiled_query(lang);
  return query.captures(tree.rootNode);
}

