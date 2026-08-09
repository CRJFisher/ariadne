/**
 * Decide which textual `name(` occurrences can be call sites.
 *
 * Two rules, both exact rather than heuristic, because a hit that is not a call
 * fabricates a caller and mis-routes the entry's fault area:
 *
 *   - A hit inside a comment or a string is prose. Comment extent is decided by
 *     scanning each file once, carrying block-comment and docstring state across
 *     lines — a line-prefix test cannot tell a Rust deref (`*c.borrow_mut()`)
 *     from a JSDoc continuation, nor see a call after `/* … *\/` on one line.
 *   - A hit landing where a callable of the same name is declared is that
 *     declaration — a sibling class's override, an abstract signature, the
 *     entry's own `def` line.
 *
 * Both channels of grep evidence (the indexed corpus and the out-of-index
 * fallback) qualify hits through this module, so neither can report a mention
 * as a caller.
 */

import type { CallableDefinition, FilePath, Language } from "@ariadnejs/types";

/** Half-open `[start, end)` column range of a line that holds code. */
export type CodeRange = readonly [number, number];

/**
 * Comment and string syntax per language. Total over `Language`, so adding a
 * language is a compile error here rather than a silent fall-through to
 * "everything is code".
 *
 * @language javascript,typescript,python,rust
 */
interface CommentSyntax {
  readonly line_comment: readonly string[];
  readonly block_comment: boolean;
  /** Rust nests block comments; JS/TS close on the first terminator. */
  readonly nested_block_comment: boolean;
  /**
   * Quote characters opening a single-line literal whose contents are text, not
   * code — a `name(` inside one is a mention.
   */
  readonly quotes: readonly string[];
  /**
   * Quote characters opening a literal that may still hold code, so its
   * contents stay eligible: a JS template literal interpolates real calls
   * (`${render(x)}`). Scanning still skips the literal so a `//` inside a URL
   * does not read as a comment.
   */
  readonly code_quotes: readonly string[];
  /** Python's `"""` / `'''`, which span lines. */
  readonly triple_quotes: readonly string[];
}

const COMMENT_SYNTAX: Record<Language, CommentSyntax> = {
  javascript: {
    line_comment: ["//"],
    block_comment: true,
    nested_block_comment: false,
    quotes: ["\"", "'"],
    code_quotes: ["`"],
    triple_quotes: [],
  },
  typescript: {
    line_comment: ["//"],
    block_comment: true,
    nested_block_comment: false,
    quotes: ["\"", "'"],
    code_quotes: ["`"],
    triple_quotes: [],
  },
  python: {
    line_comment: ["#"],
    block_comment: false,
    nested_block_comment: false,
    quotes: ["\"", "'"],
    code_quotes: [],
    triple_quotes: ["\"\"\"", "'''"],
  },
  rust: {
    line_comment: ["//"],
    block_comment: true,
    nested_block_comment: true,
    // `'` opens a lifetime far more often than a char literal, and treating it
    // as a string delimiter would swallow the rest of the line.
    quotes: ["\""],
    code_quotes: [],
    triple_quotes: [],
  },
};

/**
 * Columns of each line that hold code rather than comment or string content.
 *
 * One pass over the file, carrying block-comment and docstring state between
 * lines. A line entirely inside a block comment yields no range.
 */
export function build_code_ranges(
  lines: readonly string[],
  language: Language,
): CodeRange[][] {
  const syntax = COMMENT_SYNTAX[language];
  const ranges_by_line: CodeRange[][] = [];

  let block_depth = 0;
  let open_triple: string | null = null;

  for (const line of lines) {
    const ranges: CodeRange[] = [];
    // A line that opens inside a block comment or docstring holds no code until
    // that construct closes on it.
    let code_start = block_depth > 0 || open_triple !== null ? line.length : 0;
    let i = 0;

    const close_code_at = (end: number): void => {
      if (end > code_start) ranges.push([code_start, end]);
    };

    while (i < line.length) {
      if (block_depth > 0) {
        if (syntax.nested_block_comment && line.startsWith("/*", i)) {
          block_depth++;
          i += 2;
          continue;
        }
        if (line.startsWith("*/", i)) {
          block_depth--;
          i += 2;
          if (block_depth === 0) code_start = i;
          continue;
        }
        i++;
        continue;
      }

      if (open_triple !== null) {
        if (line.startsWith(open_triple, i)) {
          i += open_triple.length;
          open_triple = null;
          code_start = i;
          continue;
        }
        i++;
        continue;
      }

      const triple = syntax.triple_quotes.find((q) => line.startsWith(q, i));
      if (triple !== undefined) {
        close_code_at(i);
        i += triple.length;
        const closing = line.indexOf(triple, i);
        if (closing === -1) {
          open_triple = triple;
          code_start = line.length;
          i = line.length;
        } else {
          i = closing + triple.length;
          code_start = i;
        }
        continue;
      }

      const line_comment = syntax.line_comment.find((c) => line.startsWith(c, i));
      if (line_comment !== undefined) {
        close_code_at(i);
        code_start = line.length;
        i = line.length;
        continue;
      }

      if (syntax.block_comment && line.startsWith("/*", i)) {
        close_code_at(i);
        block_depth = 1;
        i += 2;
        code_start = line.length;
        continue;
      }

      if (syntax.quotes.includes(line[i])) {
        close_code_at(i);
        i = skip_string_literal(line, i);
        code_start = i;
        continue;
      }

      if (syntax.code_quotes.includes(line[i])) {
        i = skip_string_literal(line, i);
        continue;
      }

      i++;
    }

    close_code_at(line.length);
    ranges_by_line.push(ranges);
  }

  return ranges_by_line;
}

/**
 * Index just past a single-line string literal opened at `open`. An unterminated
 * literal runs to end of line, which is what a broken or continued line means
 * for the purpose of finding call syntax.
 */
function skip_string_literal(line: string, open: number): number {
  const quote = line[open];
  let i = open + 1;
  while (i < line.length) {
    if (line[i] === "\\") {
      i += 2;
      continue;
    }
    if (line[i] === quote) return i + 1;
    i++;
  }
  return line.length;
}

export function is_code_column(ranges: readonly CodeRange[], column: number): boolean {
  for (const [start, end] of ranges) {
    if (column >= start && column < end) return true;
  }
  return false;
}

/**
 * Key identifying a line that declares a callable of a given name.
 *
 * The name is part of the key so that a genuine call sharing a line with an
 * unrelated declaration survives — `export const wrap = () => make_id();`
 * declares `wrap`, not `make_id`.
 */
export function declaration_key(
  file_path: FilePath | string,
  line: number,
  name: string,
): string {
  return `${file_path}:${line}:${name}`;
}

/**
 * Every line at which a callable is declared, keyed by
 * `declaration_key`.
 *
 * Covers the declaration shapes the indexer records as callable definitions:
 * function and method definitions, constructors, interface and abstract method
 * signatures. Shapes the indexer does not record — TypeScript overload
 * signatures, `declare function`, object-literal method shorthand — are absent
 * here and still count as call sites.
 */
export function build_callable_declaration_keys(
  callable_definitions: readonly CallableDefinition[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const def of callable_definitions) {
    keys.add(
      declaration_key(def.location.file_path, def.location.start_line, def.name as string),
    );
  }
  return keys;
}
