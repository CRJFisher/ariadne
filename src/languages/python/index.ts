import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import fs from "fs";
import path from "path";
import { LanguageConfig } from "../../types";

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
};
