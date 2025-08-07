import Parser from "tree-sitter";
import fs from "fs";
import path from "path";
import { LanguageConfig } from "../../types";

const rust_language = require('tree-sitter-rust');

function initialize_parser(): Parser {
  const parser = new Parser();
  parser.setLanguage(rust_language);
  
  // Set a reasonable timeout (default is very low)
  parser.setTimeoutMicros(5000000); // 5 seconds
  
  return parser;
}

// Try multiple paths to find the scopes.scm file
function get_scope_query(): string {
  const possible_paths = [
    // When running from compiled dist/
    path.join(__dirname, "scopes.scm"),
    // When running from source during tests
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "src",
      "languages",
      "rust",
      "scopes.scm"
    ),
    // Direct source path (for Jest tests)
    path.join(process.cwd(), "src", "languages", "rust", "scopes.scm"),
    // Alternative source path for different working directories
    path.resolve(__dirname, "scopes.scm"),
    path.resolve(__dirname, "../../../src/languages/rust/scopes.scm"),
    // Dist path
    path.join(process.cwd(), "dist", "languages", "rust", "scopes.scm"),
  ];

  for (const p of possible_paths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf8");
      }
    } catch (e) {
      // Continue to next path
    }
  }

  // Final attempt: look for scopes.scm in the same directory as this file's source
  const sourceDir = path.dirname(__filename.replace(/\.js$/, ".ts"));
  const sourcePath = path.join(sourceDir, "scopes.scm");
  try {
    if (fs.existsSync(sourcePath)) {
      return fs.readFileSync(sourcePath, "utf8");
    }
  } catch (e) {
    // Ignore
  }

  throw new Error(
    `Could not find scopes.scm for Rust. Tried paths: ${possible_paths.join(
      ", "
    )}`
  );
}

export const rust_config: LanguageConfig = {
  name: "rust",
  file_extensions: ["rs"],
  parser: initialize_parser(),
  scope_query: get_scope_query(),
  namespaces: [
    [
      // variables
      "const",
      "function",
      "method",
      "variable",
      // types
      "struct",
      "enum",
      "union",
      "typedef",
      "interface",
      // fields
      "field",
      "enumerator",
      // namespacing
      "module",
      // misc
      "label",
      "lifetime",
    ],
  ],
};