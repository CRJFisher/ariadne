import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import fs from "fs";
import path from "path";
import { LanguageConfig } from "../../types";

// Lazy initialization of parser
let _parser: Parser | null = null;

function get_parser(): Parser {
  if (!_parser) {
    console.log("[TS] Lazy-initializing TypeScript parser...");
    _parser = new Parser();
    // We use `as any` here to bypass a type mismatch caused by
    // the peer dependency conflict between tree-sitter and tree-sitter-typescript.
    // Use tsx language which includes TypeScript + JSX support
    _parser.setLanguage(TypeScript.tsx as any);
    
    // Set a reasonable timeout (default is very low)
    _parser.setTimeoutMicros(5000000); // 5 seconds
    console.log("[TS] Parser initialized successfully");
  }
  return _parser;
}

// Lazy initialization of scope query
let _scope_query: string | null = null;

function get_scope_query(): string {
  if (_scope_query) {
    return _scope_query;
  }

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
      "typescript",
      "scopes.scm"
    ),
    // Direct source path (for Jest tests)
    path.join(process.cwd(), "src", "languages", "typescript", "scopes.scm"),
    // Alternative source path for different working directories
    path.resolve(__dirname, "scopes.scm"),
    path.resolve(__dirname, "../../../src/languages/typescript/scopes.scm"),
    // Dist path
    path.join(process.cwd(), "dist", "languages", "typescript", "scopes.scm"),
  ];

  for (const p of possible_paths) {
    try {
      if (fs.existsSync(p)) {
        _scope_query = fs.readFileSync(p, "utf8");
        return _scope_query;
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
      _scope_query = fs.readFileSync(sourcePath, "utf8");
      return _scope_query;
    }
  } catch (e) {
    // Ignore
  }

  throw new Error(
    `Could not find scopes.scm for TypeScript. Tried paths: ${possible_paths.join(
      ", "
    )}`
  );
}

export const typescript_config: LanguageConfig = {
  name: "typescript",
  file_extensions: ["ts", "tsx"],
  get parser() {
    return get_parser();
  },
  get scope_query() {
    return get_scope_query();
  },
  namespaces: [
    [
      // functions
      "function",
      "generator",
      "method",
      "class",
      "interface",
      "enum",
      "alias",
    ],
    [
      // variables
      "variable",
      "constant",
      "parameter",
      "property",
      "enumerator",
      "label",
    ],
  ],
};