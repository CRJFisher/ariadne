import type TreeSitter from "tree-sitter";
import { Parser } from "../native";
import type { FilePath, Language } from "@ariadnejs/types";
import type { ParsedFile } from "../index_single_file/parsed_file";
import { assert_language } from "../detect_language";
import { LANGUAGE_TO_TREESITTER_LANG } from "../index_single_file/query_code_tree/parsers";

function get_parser(language: Language): TreeSitter {
  const grammar = LANGUAGE_TO_TREESITTER_LANG.get(language);
  if (!grammar) {
    throw new Error(`Unsupported language: ${language}`);
  }
  const parser = new Parser();
  parser.setLanguage(grammar);
  return parser;
}

/**
 * The single parse-phase language dispatch: detects the language from the
 * path (failing loud on unsupported extensions — only supported files may
 * reach the parser) and produces the ParsedFile that carries that language
 * through the rest of the pipeline.
 */
export function parse_file(
  file_path: FilePath,
  content: string,
  buffer_size: number
): ParsedFile {
  const language = assert_language(file_path);
  const parser = get_parser(language);
  const tree = parser.parse(content, undefined, { bufferSize: buffer_size });

  const lines = content.split("\n");
  return {
    file_path,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}
