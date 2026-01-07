import type { Language } from "@ariadnejs/types";
import { type Tree, Query, type QueryCapture } from "tree-sitter";
import {
  load_query,
  LANGUAGE_TO_TREESITTER_LANG,
} from "./query_loader";
import { profiler } from "../../profiling";

/**
 * Query tree and get raw captures
 * Returns raw tree-sitter captures for processing
 */
export function query_tree(lang: Language, tree: Tree): QueryCapture[] {
  profiler.start("load_query");
  const query_string = load_query(lang);
  profiler.end("load_query");

  const parser = LANGUAGE_TO_TREESITTER_LANG.get(lang);
  if (!parser) {
    throw new Error(`No tree-sitter parser found for language: ${lang}`);
  }

  profiler.start("query_compile");
  const query = new Query(parser, query_string);
  profiler.end("query_compile");

  profiler.start("query_execute");
  const captures = query.captures(tree.rootNode);
  profiler.end("query_execute");

  // Return raw captures directly
  return captures;
}