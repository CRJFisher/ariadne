import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import fs from "fs";
import path from "path";
import { LanguageConfig } from "../../types";

console.log("[PY DEBUG] Loading Python language module...");
console.log("[PY DEBUG] Python module:", Python);
console.log("[PY DEBUG] typeof Python:", typeof Python);

// Check if the native module is loaded
try {
  if (typeof Python === 'function') {
    console.log("[PY DEBUG] Python is a function (legacy tree-sitter API)");
  } else if (typeof Python === 'object' && Python.language) {
    console.log("[PY DEBUG] Python has language property");
    console.log("[PY DEBUG] Python.language:", Python.language);
  } else {
    console.log("[PY DEBUG] Python module structure:", Object.keys(Python || {}));
  }
} catch (e) {
  console.error("[PY DEBUG] Error inspecting Python module:", e);
}

function initialize_parser(): Parser {
  console.log("[PY DEBUG] Initializing Python parser...");
  
  try {
    const parser = new Parser();
    console.log("[PY DEBUG] Parser created successfully");
    
    // Handle both old and new tree-sitter API
    console.log("[PY DEBUG] Setting language...");
    if (typeof Python === 'function') {
      // Old API
      console.log("[PY DEBUG] Using legacy API (Python as function)");
      parser.setLanguage(Python as any);
    } else if (Python.language) {
      // New API
      console.log("[PY DEBUG] Using new API (Python.language)");
      parser.setLanguage(Python.language as any);
    } else {
      console.error("[PY DEBUG] Unknown Python module format");
      parser.setLanguage(Python as any);
    }
    console.log("[PY DEBUG] Language set successfully");
    
    // Test parsing a simple expression
    console.log("[PY DEBUG] Testing parser with simple code...");
    const testTree = parser.parse("x = 1");
    console.log("[PY DEBUG] Test parse result:", testTree.rootNode ? "SUCCESS" : "FAILED");
    if (testTree.rootNode) {
      console.log("[PY DEBUG] Root node type:", testTree.rootNode.type);
      console.log("[PY DEBUG] Root node string:", testTree.rootNode.toString());
    }
    
    // Set timeout
    parser.setTimeoutMicros(5000000); // 5 seconds
    console.log("[PY DEBUG] Parser timeout set to 5 seconds");
    
    return parser;
  } catch (e) {
    console.error("[PY DEBUG] Failed to initialize parser:", e);
    console.error("[PY DEBUG] Error stack:", (e as Error).stack);
    throw e;
  }
}

function get_scope_query(): string {
  console.log("[PY DEBUG] Looking for scopes.scm file...");
  console.log("[PY DEBUG] Current directory:", process.cwd());
  console.log("[PY DEBUG] __dirname:", __dirname);
  console.log("[PY DEBUG] __filename:", __filename);
  
  const scopePath = path.join(__dirname, "scopes.scm");
  console.log(`[PY DEBUG] Checking primary path: ${scopePath}`);
  
  if (fs.existsSync(scopePath)) {
    console.log(`[PY DEBUG] Found scopes.scm at: ${scopePath}`);
    const content = fs.readFileSync(scopePath, "utf8");
    console.log(`[PY DEBUG] File size: ${content.length} bytes`);
    return content;
  } else {
    // Fallback to source directory for tests
    const sourcePath = path.join(
      __dirname,
      "../../../src/languages/python/scopes.scm"
    );
    console.log(`[PY DEBUG] Primary path not found, checking: ${sourcePath}`);
    
    if (fs.existsSync(sourcePath)) {
      console.log(`[PY DEBUG] Found scopes.scm at: ${sourcePath}`);
      const content = fs.readFileSync(sourcePath, "utf8");
      console.log(`[PY DEBUG] File size: ${content.length} bytes`);
      return content;
    } else {
      const error = new Error(
        `Could not find scopes.scm for Python. Tried: ${scopePath}, ${sourcePath}`
      );
      console.error("[PY DEBUG] Failed to find scopes.scm:", error.message);
      throw error;
    }
  }
}

console.log("[PY DEBUG] Creating Python config...");

export const python_config: LanguageConfig = {
  name: "python",
  file_extensions: ["py"],
  parser: initialize_parser(),
  scope_query: get_scope_query(),
  namespaces: [
    ["function", "generator", "method", "class"],
    ["variable", "constant", "parameter", "member", "label"],
  ],
};

console.log("[PY DEBUG] Python config created successfully");