import type TreeSitter from "tree-sitter";
import { Parser } from "../native";
import type { FilePath, Language } from "@ariadnejs/types";
import type { ParsedFile } from "../index_single_file/parsed_file";
import { assert_language } from "../detect_language";
import { blank_mdx_frontmatter } from "./blank_mdx_frontmatter";
import { grammar_for } from "../index_single_file/query_code_tree/parsers";

function get_parser(language: Language, file_path: FilePath): TreeSitter {
  const parser = new Parser();
  // `.tsx` parses with the tsx grammar (JSX), `.ts` with the typescript grammar
  // (angle-bracket casts); grammar_for owns that dispatch.
  parser.setLanguage(grammar_for(language, file_path));
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
  const parser = get_parser(language, file_path);
  // MDX collapses to the JavaScript language, so its YAML frontmatter reaches
  // the JS grammar; blank it first so the block does not swallow the following
  // import. Blanking preserves line/column positions, leaving other content's
  // locations intact.
  const parse_content = file_path.endsWith(".mdx")
    ? blank_mdx_frontmatter(content)
    : content;
  const tree = parser.parse(parse_content, undefined, {
    bufferSize: buffer_size,
  });

  const lines = content.split("\n");
  return {
    file_path,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}
