import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import fs from "fs";
import path from "path";
import { LanguageConfig } from "../../types";

console.log("[TS DEBUG] Loading TypeScript language module...");
console.log("[TS DEBUG] TypeScript module:", TypeScript);
console.log("[TS DEBUG] TypeScript.tsx:", TypeScript.tsx);
console.log("[TS DEBUG] typeof TypeScript.tsx:", typeof TypeScript.tsx);

// Check if the native module is loaded
try {
  console.log("[TS DEBUG] TypeScript module keys:", Object.keys(TypeScript));
  console.log("[TS DEBUG] TypeScript.tsx type check:", TypeScript.tsx && typeof TypeScript.tsx.nodeTypeInfo);
} catch (e) {
  console.error("[TS DEBUG] Error inspecting TypeScript module:", e);
}

function initialize_parser(): Parser {
  console.log("[TS DEBUG] Initializing TypeScript parser...");
  
  try {
    const parser = new Parser();
    console.log("[TS DEBUG] Parser created successfully");
    
    // Test if we can access the language
    console.log("[TS DEBUG] Setting language...");
    parser.setLanguage(TypeScript.tsx as any);
    console.log("[TS DEBUG] Language set successfully");
    
    // Test parsing a simple expression
    console.log("[TS DEBUG] Testing parser with simple code...");
    const testTree = parser.parse("const x = 1");
    console.log("[TS DEBUG] Test parse result:", testTree.rootNode ? "SUCCESS" : "FAILED");
    if (testTree.rootNode) {
      console.log("[TS DEBUG] Root node type:", testTree.rootNode.type);
    }
    
    // Set timeout
    parser.setTimeoutMicros(5000000); // 5 seconds
    console.log("[TS DEBUG] Parser timeout set to 5 seconds");
    
    return parser;
  } catch (e) {
    console.error("[TS DEBUG] Failed to initialize parser:", e);
    console.error("[TS DEBUG] Error stack:", (e as Error).stack);
    throw e;
  }
}

// Try multiple paths to find the scopes.scm file
function get_scope_query(): string {
  console.log("[TS DEBUG] Looking for scopes.scm file...");
  console.log("[TS DEBUG] Current directory:", process.cwd());
  console.log("[TS DEBUG] __dirname:", __dirname);
  console.log("[TS DEBUG] __filename:", __filename);
  
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

  console.log("[TS DEBUG] Searching for scopes.scm in paths:");
  for (const p of possible_paths) {
    console.log(`[TS DEBUG]   - ${p}`);
    try {
      if (fs.existsSync(p)) {
        console.log(`[TS DEBUG] Found scopes.scm at: ${p}`);
        const content = fs.readFileSync(p, "utf8");
        console.log(`[TS DEBUG] File size: ${content.length} bytes`);
        return content;
      }
    } catch (e) {
      console.log(`[TS DEBUG] Error checking ${p}:`, e);
    }
  }

  // Final attempt: look for scopes.scm in the same directory as this file's source
  const sourceDir = path.dirname(__filename.replace(/\.js$/, ".ts"));
  const sourcePath = path.join(sourceDir, "scopes.scm");
  console.log(`[TS DEBUG] Final attempt at: ${sourcePath}`);
  try {
    if (fs.existsSync(sourcePath)) {
      console.log(`[TS DEBUG] Found scopes.scm at: ${sourcePath}`);
      return fs.readFileSync(sourcePath, "utf8");
    }
  } catch (e) {
    console.log(`[TS DEBUG] Error checking ${sourcePath}:`, e);
  }

  const error = new Error(
    `Could not find scopes.scm for TypeScript. Tried paths: ${possible_paths.join(
      ", "
    )}`
  );
  console.error("[TS DEBUG] Failed to find scopes.scm:", error.message);
  throw error;
}

console.log("[TS DEBUG] Creating TypeScript config...");

export const typescript_config: LanguageConfig = {
  name: "typescript",
  file_extensions: ["ts", "tsx"],
  parser: initialize_parser(),
  scope_query: get_scope_query(),
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

console.log("[TS DEBUG] TypeScript config created successfully");