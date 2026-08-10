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

import type {
  CallableDefinition,
  ClassDefinition,
  FilePath,
  Language,
} from "@ariadnejs/types";

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
   * Quote characters whose literal always interpolates — a JS template
   * literal. Its text is prose like any other literal; only the interpolated
   * spans hold code.
   */
  readonly interpolated_quotes: readonly string[];
  /**
   * Letters that mark an otherwise-plain literal as interpolating when written
   * immediately before the quote: Python's `f"…"`, `rf'…'`, `F"""…"""`.
   */
  readonly interpolation_prefixes: readonly string[];
  /** Sequence opening an interpolated span inside such a literal. */
  readonly interpolation_open: string;
  /** Python's `"""` / `'''`, which span lines. */
  readonly triple_quotes: readonly string[];
}

/**
 * Letters that may precede a Python string quote as part of its prefix. Bounded
 * so an ordinary identifier abutting a quote cannot read as one.
 */
const PYTHON_STRING_PREFIX_LETTERS = /^[rbuf]{1,3}$/i;

const COMMENT_SYNTAX: Record<Language, CommentSyntax> = {
  javascript: {
    line_comment: ["//"],
    block_comment: true,
    nested_block_comment: false,
    quotes: ["\"", "'"],
    interpolated_quotes: ["`"],
    interpolation_prefixes: [],
    interpolation_open: "${",
    triple_quotes: [],
  },
  typescript: {
    line_comment: ["//"],
    block_comment: true,
    nested_block_comment: false,
    quotes: ["\"", "'"],
    interpolated_quotes: ["`"],
    interpolation_prefixes: [],
    interpolation_open: "${",
    triple_quotes: [],
  },
  python: {
    line_comment: ["#"],
    block_comment: false,
    nested_block_comment: false,
    quotes: ["\"", "'"],
    interpolated_quotes: [],
    interpolation_prefixes: ["f"],
    interpolation_open: "{",
    triple_quotes: ["\"\"\"", "'''"],
  },
  rust: {
    line_comment: ["//"],
    block_comment: true,
    nested_block_comment: true,
    // `'` opens a lifetime far more often than a char literal, and treating it
    // as a string delimiter would swallow the rest of the line.
    quotes: ["\""],
    interpolated_quotes: [],
    // `format!("{}", x)` interpolates by position, not by expression, so a
    // braced span in a Rust literal holds no call syntax.
    interpolation_prefixes: [],
    interpolation_open: "{",
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
  let open_triple: { quote: string; interpolates: boolean } | null = null;

  for (const line of lines) {
    const ranges: CodeRange[] = [];
    // A line that opens inside a block comment or docstring holds no code until
    // that construct closes on it.
    let code_start = block_depth > 0 || open_triple !== null ? line.length : 0;
    let i = 0;

    if (open_triple !== null && open_triple.interpolates) {
      const closing = line.indexOf(open_triple.quote);
      scan_interpolations(
        line,
        0,
        closing === -1 ? line.length : closing,
        syntax,
        ranges,
      );
    }

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
        if (line.startsWith(open_triple.quote, i)) {
          i += open_triple.quote.length;
          open_triple = null;
          code_start = i;
          continue;
        }
        i++;
        continue;
      }

      const triple = syntax.triple_quotes.find((q) => line.startsWith(q, i));
      if (triple !== undefined) {
        const interpolates = has_interpolation_prefix(line, i, syntax);
        close_code_at(i);
        i += triple.length;
        const closing = line.indexOf(triple, i);
        const body_end = closing === -1 ? line.length : closing;
        if (interpolates) {
          scan_interpolations(line, i, body_end, syntax, ranges);
        }
        if (closing === -1) {
          open_triple = { quote: triple, interpolates };
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

      const interpolated_quote = syntax.interpolated_quotes.includes(line[i]);
      if (interpolated_quote || syntax.quotes.includes(line[i])) {
        const interpolates =
          interpolated_quote || has_interpolation_prefix(line, i, syntax);
        close_code_at(i);
        const after = skip_string_literal(line, i);
        if (interpolates) {
          // The closing quote is excluded when the literal terminated, so an
          // interpolation cannot be read out of the delimiter itself.
          const body_end = after > i + 1 && line[after - 1] === line[i] ? after - 1 : after;
          scan_interpolations(line, i + 1, body_end, syntax, ranges);
        }
        i = after;
        code_start = i;
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
 * Whether the literal opening at `quote_index` carries a prefix marking it as
 * interpolating — Python's `f`, alone or combined with `r`/`b`/`u`.
 */
function has_interpolation_prefix(
  line: string,
  quote_index: number,
  syntax: CommentSyntax,
): boolean {
  if (syntax.interpolation_prefixes.length === 0) return false;
  let start = quote_index;
  while (start > 0 && /[A-Za-z]/.test(line[start - 1])) start--;
  const prefix = line.slice(start, quote_index);
  if (prefix.length === 0 || !PYTHON_STRING_PREFIX_LETTERS.test(prefix)) return false;
  const lower = prefix.toLowerCase();
  return syntax.interpolation_prefixes.some((p) => lower.includes(p));
}

/**
 * Record the interpolated spans of a literal body as code.
 *
 * The literal's own text is prose, so only what sits between the interpolation
 * delimiters is eligible. Brace depth is tracked so a nested object or
 * subscript inside the span does not close it early, and a doubled opener is
 * the language's escape for a literal brace.
 */
function scan_interpolations(
  line: string,
  body_start: number,
  body_end: number,
  syntax: CommentSyntax,
  ranges: CodeRange[],
): void {
  const open = syntax.interpolation_open;
  let i = body_start;
  while (i < body_end) {
    if (!line.startsWith(open, i)) {
      i++;
      continue;
    }
    // `{{` in an f-string, `${$` never — a doubled single-char opener is the
    // escape for a literal brace and interpolates nothing.
    if (open.length === 1 && line.startsWith(open + open, i)) {
      i += 2;
      continue;
    }
    const span_start = i + open.length;
    let depth = 1;
    let j = span_start;
    while (j < body_end && depth > 0) {
      if (line[j] === "{") depth++;
      else if (line[j] === "}") depth--;
      if (depth === 0) break;
      j++;
    }
    if (j > span_start) ranges.push([span_start, j]);
    i = j + 1;
  }
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
  class_definitions: readonly ClassDefinition[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const def of callable_definitions) {
    keys.add(
      declaration_key(def.location.file_path, def.location.start_line, def.name as string),
    );
  }
  // Class headers too, because a constructor is looked up by its class name:
  // `class Reporter {` declares `Reporter`, it does not mention it.
  for (const def of class_definitions) {
    keys.add(
      declaration_key(def.location.file_path, def.location.start_line, def.name as string),
    );
  }
  return keys;
}
