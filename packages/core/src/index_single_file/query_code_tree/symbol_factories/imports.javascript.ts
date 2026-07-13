import type { SyntaxNode } from "tree-sitter";
import type { ModulePath, SymbolName } from "@ariadnejs/types";

/**
 * Extract import path from import statement
 */
export function extract_import_path(node: SyntaxNode | null | undefined): ModulePath {
  if (!node) {
    return "" as ModulePath;
  }
  // Use childForFieldName without optional chaining - it exists on SyntaxNode
  const source = node.childForFieldName("source");
  if (source) {
    // Remove quotes from the string literal
    const text = source.text;
    return text.slice(1, -1) as ModulePath;
  }
  return "" as ModulePath;
}

/**
 * Extract module path from require() call
 * For CommonJS: const x = require('./module')
 */
export function extract_require_path(node: SyntaxNode | null | undefined): ModulePath {
  if (!node || node.type !== "string") {
    return "" as ModulePath;
  }
  // Remove quotes from the string literal
  const text = node.text;
  return text.slice(1, -1) as ModulePath;
}

/**
 * Extract original name for aliased imports
 */
export function extract_original_name(
  node: SyntaxNode | null,
  local_name: SymbolName
): SymbolName | undefined {
  if (!node) {
    return undefined;
  }

  // Find import_clause as a child (not a field in JavaScript grammar)
  let import_clause: SyntaxNode | null = null;
  for (const child of node.children || []) {
    if (child.type === "import_clause") {
      import_clause = child;
      break;
    }
  }

  if (import_clause) {
    // Find named_imports as a child (not a field)
    let named_imports: SyntaxNode | null = null;
    for (const child of import_clause.children || []) {
      if (child.type === "named_imports") {
        named_imports = child;
        break;
      }
    }

    if (named_imports) {
      for (const child of named_imports.children || []) {
        if (child.type === "import_specifier") {
          const alias = child.childForFieldName("alias"); // alias IS a field
          if (alias?.text === local_name) {
            const name = child.childForFieldName("name"); // name IS a field
            return name?.text as SymbolName;
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Check if this is a default import
 * Default import: import formatDate from './utils'
 * Structure: import_clause contains a direct identifier child (not inside named_imports)
 */
export function is_default_import(node: SyntaxNode, name: SymbolName): boolean {
  // Find import_clause as a child (not a field in JavaScript grammar)
  let import_clause: SyntaxNode | null = null;
  for (const child of node.children || []) {
    if (child.type === "import_clause") {
      import_clause = child;
      break;
    }
  }

  if (import_clause) {
    // Check if import_clause has a direct identifier child (the default import)
    // This identifier is NOT inside named_imports or namespace_import
    for (const child of import_clause.children || []) {
      if (child.type === "identifier" && child.text === name) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if this is a namespace import
 */
export function is_namespace_import(node: SyntaxNode): boolean {
  // Find import_clause child (may not have a field name)
  const import_clause = node.children.find(c => c.type === "import_clause");
  if (import_clause) {
    // Check if it contains a namespace_import child
    const namespace_import = import_clause.children.find(c => c.type === "namespace_import");
    return namespace_import !== undefined;
  }
  return false;
}
