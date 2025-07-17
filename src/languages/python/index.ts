import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import fs from "fs";
import path from "path";
import { LanguageConfig, ExtractedContext } from "../../types";
import { SyntaxNode } from 'tree-sitter';

function initialize_parser(): Parser {
  const parser = new Parser();
  try {
    // We use `as any` here to bypass a type mismatch caused by
    // the peer dependency conflict between tree-sitter and tree-sitter-python.
    parser.setLanguage(Python as any);

    // Verify the language was set correctly
    const lang = parser.getLanguage();
    if (!lang) {
      throw new Error("Language was not set correctly");
    }

    // Set a reasonable timeout (default is very low)
    parser.setTimeoutMicros(5000000); // 5 seconds
  } catch (e) {
    console.error("Failed to set Python language:", e);
    console.error("Python module:", Python);
    console.error("Platform:", process.platform, "Arch:", process.arch);
    throw e;
  }
  return parser;
}

// Simple, reliable asset loading
function get_scope_query(): string {
  // Try the standard location first (works in both dev and dist)
  const scopePath = path.join(__dirname, "scopes.scm");

  try {
    return fs.readFileSync(scopePath, "utf8");
  } catch (e) {
    // Fallback for test environments - look in source directory
    const sourcePath = path.join(
      __dirname,
      "../../../src/languages/python/scopes.scm"
    );
    try {
      return fs.readFileSync(sourcePath, "utf8");
    } catch (e2) {
      throw new Error(
        `Could not find scopes.scm for Python. Tried: ${scopePath}, ${sourcePath}`
      );
    }
  }
}

/**
 * Extract Python-specific context (decorators and docstrings)
 */
function extract_python_context(
  node: SyntaxNode,
  source_lines: string[],
  start_line: number
): ExtractedContext {
  const context: ExtractedContext = {};
  
  // Extract decorators - lines starting with @ before the definition
  const decorators: string[] = [];
  let line_index = start_line - 1;
  while (line_index >= 0) {
    const line = source_lines[line_index].trim();
    if (line.startsWith('@')) {
      decorators.unshift(line);
      line_index--;
    } else if (line === '') {
      // Skip empty lines
      line_index--;
    } else {
      // Stop at first non-decorator, non-empty line
      break;
    }
  }
  if (decorators.length > 0) {
    context.decorators = decorators;
  }
  
  // Extract docstring - look for string literal as first statement in function
  if (node.type === 'function_definition' || node.type === 'decorated_definition') {
    // Find the function body
    let body_node: SyntaxNode | null = null;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'block') {
        body_node = child;
        break;
      }
    }
    
    if (body_node && body_node.childCount > 0) {
      // Look for first non-comment statement
      for (let i = 0; i < body_node.childCount; i++) {
        const stmt = body_node.child(i);
        if (stmt && stmt.type === 'expression_statement') {
          const expr = stmt.child(0);
          if (expr && expr.type === 'string') {
            // Extract the string content
            const string_text = expr.text;
            if (string_text.startsWith('"""') || string_text.startsWith("'''")) {
              const quote_type = string_text.substring(0, 3);
              const end_index = string_text.lastIndexOf(quote_type);
              if (end_index > 3) {
                context.docstring = string_text.substring(3, end_index).trim();
              }
            } else if (string_text.startsWith('"') || string_text.startsWith("'")) {
              const quote_type = string_text[0];
              const end_index = string_text.lastIndexOf(quote_type);
              if (end_index > 0) {
                context.docstring = string_text.substring(1, end_index).trim();
              }
            }
            break; // Only check first statement
          }
        } else if (stmt && stmt.type !== 'comment') {
          // Non-comment, non-string statement - no docstring
          break;
        }
      }
    }
  }
  
  return context;
}

export const python_config: LanguageConfig = {
  name: "python",
  file_extensions: ["py", "pyi", "pyw"],
  parser: initialize_parser(),
  scope_query: get_scope_query(),
  namespaces: [
    [
      // functions and classes
      "function",
      "method",
      "class",
      "async_function",
      "async_method",
      "generator",
      "async_generator",
      "decorator",
    ],
    [
      // variables
      "variable",
      "constant",
      "parameter",
      "attribute",
      "property",
      "global",
      "nonlocal",
    ],
  ],
  extract_context: extract_python_context,
};
