/**
 * JSDoc type extraction for JavaScript
 *
 * JavaScript declares types in JSDoc comments rather than structural
 * annotations. These helpers locate the JSDoc block governing a node and read
 * the type out of its `@type` and `@param` tags so a value's declared type
 * survives indexing.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";

/**
 * Extract type from a JSDoc `@type {TypeName}` tag in a comment string.
 *
 * Sibling: `extract_jsdoc_param_type` handles `@param {T} name` tags; this one
 * handles `@type` for variables and properties.
 */
export function extract_jsdoc_type(comment_text: string): SymbolName | undefined {
  // Handles single-line /** @type {Foo} */ and multi-line ` * @type {Bar}`.
  const type_match = comment_text.match(/@type\s*\{([^}]+)\}/);
  if (type_match && type_match[1]) {
    return type_match[1].trim() as SymbolName;
  }
  return undefined;
}

/**
 * Find the JSDoc comment immediately preceding a node.
 *
 * Checks the node's own previous siblings and its parent's previous siblings so
 * a comment attached one wrapper level up (e.g. a field_definition) is still
 * found. Returns the comment node, or undefined when there is none.
 */
export function find_preceding_jsdoc(node: SyntaxNode): SyntaxNode | undefined {
  let current = node.previousSibling;

  while (current && (current.type === "comment" || current.text.trim() === "")) {
    if (current.type === "comment" && current.text.startsWith("/**")) {
      return current;
    }
    current = current.previousSibling;
  }

  if (node.parent) {
    current = node.parent.previousSibling;
    while (current && (current.type === "comment" || current.text.trim() === "")) {
      if (current.type === "comment" && current.text.startsWith("/**")) {
        return current;
      }
      current = current.previousSibling;
    }
  }

  return undefined;
}

// Ancestor-stop set for the climb from a parameter to the JSDoc that documents
// it. Broader than find_containing_callable's symbol-building list (it includes
// generators and bare expressions) because here any function-like boundary ends
// the search — we only need to anchor the @param lookup, not name the callable.
const FUNCTION_LIKE_TYPES = new Set([
  "function_declaration",
  "generator_function_declaration",
  "function_expression",
  "generator_function",
  "arrow_function",
  "method_definition",
  "function",
]);

/**
 * Extract a parameter's type from the enclosing function's JSDoc `@param` tag.
 *
 * The capture node is the bare parameter identifier; its declared type may live
 * only in a `@param {T} <name>` tag on the function's leading JSDoc block. Climb
 * to the enclosing function-like node, locate that block, and return the type of
 * the tag whose name matches the parameter exactly.
 *
 * A catch-clause variable is captured under the same `@definition.parameter`
 * name but is not a function parameter; excluding it stops a same-named function
 * `@param` from typing the caught binding.
 */
export function extract_jsdoc_param_type(
  param_node: SyntaxNode
): SymbolName | undefined {
  if (param_node.parent?.type === "catch_clause") {
    return undefined;
  }

  const param_name = param_node.text;

  let fn: SyntaxNode | null = param_node.parent;
  while (fn && !FUNCTION_LIKE_TYPES.has(fn.type)) {
    fn = fn.parent;
  }
  if (!fn) {
    return undefined;
  }

  // For an arrow/function expression bound to a `const`, the JSDoc precedes the
  // declaration statement, not the expression — anchor the search there so
  // find_preceding_jsdoc's direct-previous-sibling branch reaches it.
  let comment_anchor: SyntaxNode = fn;
  if (fn.parent?.type === "variable_declarator" && fn.parent.parent) {
    comment_anchor = fn.parent.parent;
  }

  const jsdoc = find_preceding_jsdoc(comment_anchor);
  if (!jsdoc) {
    return undefined;
  }

  return match_jsdoc_param_type(jsdoc.text, param_name);
}

/**
 * Find the `@param {T} <name>` tag whose name matches exactly and return `T`.
 *
 * Matching on the full (possibly dotted) tag name by equality skips
 * documentation of nested object members (`@param {string} options.foo` never
 * types a bare `options` parameter) without positional guessing. The optional
 * `[` `]` around the name accept JSDoc optional-parameter syntax
 * (`@param {T} [name]`) so an optional parameter still matches its identifier.
 */
function match_jsdoc_param_type(
  comment_text: string,
  param_name: string
): SymbolName | undefined {
  const tag_pattern = /@param\s*\{([^}]*)\}\s*\[?\s*([A-Za-z_$][\w$.]*)\]?/g;
  let match: RegExpExecArray | null;
  while ((match = tag_pattern.exec(comment_text)) !== null) {
    const type_text = match[1].trim();
    const tag_name = match[2];
    if (tag_name === param_name && type_text) {
      return type_text as SymbolName;
    }
  }
  return undefined;
}
