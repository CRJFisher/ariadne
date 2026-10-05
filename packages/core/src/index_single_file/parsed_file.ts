import type { FilePath, Language } from "@ariadnejs/types";
import type { Tree } from "tree-sitter";

export interface ParsedFile {
  file_path: FilePath;
  file_lines: number;
  file_end_column: number;
  tree: Tree;
  lang: Language;
  /** The text the tree was parsed from. */
  source: string;
}