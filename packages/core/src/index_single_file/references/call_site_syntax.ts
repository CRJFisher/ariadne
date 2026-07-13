/**
 * Call-Site Syntax Extraction
 *
 * Extracts the syntactic context of a method call (receiver kind, call-chain
 * target shape, index-key literalness) for downstream auto-classifiers. Routes
 * to the language leaf that owns the grammar's node types; a language with no
 * recognizable method-call shape (Rust today) yields undefined, leaving the
 * signal missing rather than fabricated.
 */

import type { CallSiteSyntax, Language } from "@ariadnejs/types";
import type { SyntaxNode } from "tree-sitter";
import { extract_call_site_syntax_typescript } from "./call_site_syntax.typescript";
import { extract_call_site_syntax_python } from "./call_site_syntax.python";

export function extract_call_site_syntax(
  node: SyntaxNode,
  language: Language
): CallSiteSyntax | undefined {
  switch (language) {
    case "typescript":
    case "javascript":
      return extract_call_site_syntax_typescript(node);
    case "python":
      return extract_call_site_syntax_python(node);
    default:
      return undefined;
  }
}
