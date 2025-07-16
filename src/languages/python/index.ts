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
      "python",
      "scopes.scm"
    ),
    // Direct source path (for Jest tests)
    path.join(process.cwd(), "src", "languages", "python", "scopes.scm"),
    // Alternative source path for different working directories
    path.resolve(__dirname, "scopes.scm"),
    path.resolve(__dirname, "../../../src/languages/python/scopes.scm"),
    // Dist path
    path.join(process.cwd(), "dist", "languages", "python", "scopes.scm"),
  ];

  for (const p of possible_paths) {
    try {
      if (fs.existsSync(p)) {
        console.log(`Python: Found scopes.scm at ${p}`);
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

  console.error('Python: scopes.scm not found in any of these paths:');
  possible_paths.forEach(p => console.error(`  - ${p} (exists: ${fs.existsSync(p)})`));
  console.error(`Python: __dirname = ${__dirname}`);
  console.error(`Python: __filename = ${__filename}`);
  console.error(`Python: process.cwd() = ${process.cwd()}`);
  
  throw new Error(
    `Could not find scopes.scm for Python. Tried paths: ${possible_paths.join(
      ", "
    )}`
  );
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
