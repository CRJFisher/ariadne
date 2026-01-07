/**
 * JavaScript/TypeScript Export Analysis
 *
 * Functions for analyzing export statements and extracting export metadata.
 */
import type { SyntaxNode } from "tree-sitter";
import type { SymbolName, ExportMetadata } from "@ariadnejs/types";

/**
 * Find all export_specifier nodes in an export_clause
 * Returns array of export_specifier nodes from: export { foo, bar as baz }
 */
export function find_export_specifiers(export_node: SyntaxNode): SyntaxNode[] {
  const specifiers: SyntaxNode[] = [];

  // Look for export_clause in children (not as a named field)
  for (const child of export_node.children) {
    if (child.type === "export_clause") {
      // Find all export_specifier children
      for (const clause_child of child.children) {
        if (clause_child.type === "export_specifier") {
          specifiers.push(clause_child);
        }
      }
      break;
    }
  }

  return specifiers;
}

/**
 * Extract original name and alias from an export_specifier node
 * For "export { foo as bar }":
 *   - Returns { name: "foo", alias: "bar" }
 * For "export { foo }":
 *   - Returns { name: "foo", alias: undefined }
 */
export function extract_export_specifier_info(specifier_node: SyntaxNode): {
  name: SymbolName;
  alias?: SymbolName;
} {
  // export_specifier structure:
  // - First identifier: original name
  // - "as" keyword (if present)
  // - Second identifier: alias (if present)

  const identifiers: SyntaxNode[] = [];
  for (const child of specifier_node.children) {
    if (child.type === "identifier") {
      identifiers.push(child);
    }
  }

  if (identifiers.length === 0) {
    return { name: "unknown" as SymbolName };
  }

  const name = identifiers[0].text as SymbolName;
  const alias =
    identifiers.length > 1 ? (identifiers[1].text as SymbolName) : undefined;

  return { name, alias };
}

/**
 * Check if export statement has 'from' keyword (re-export)
 */
function has_from_clause(export_node: SyntaxNode): boolean {
  return export_node.children.some((child) => child.type === "from");
}

/**
 * Check if export statement has 'default' keyword
 */
function has_default_keyword(export_node: SyntaxNode): boolean {
  return export_node.children.some((child) => child.type === "default");
}

/**
 * Analyze export statement to extract metadata for a specific symbol
 * @param export_node The export_statement node
 * @param symbol_name The name of the symbol we're checking (e.g., "foo" from "function foo()")
 * @returns Export metadata if this export applies to the symbol
 */
export function analyze_export_statement(
  export_node: SyntaxNode,
  symbol_name?: SymbolName
): ExportMetadata | undefined {
  // Check for export default
  if (has_default_keyword(export_node)) {
    return { is_default: true };
  }

  // Check for re-export: export { x } from './y'
  const is_reexport = has_from_clause(export_node);
  if (is_reexport) {
    // For re-exports, check if this specific symbol is being re-exported
    if (symbol_name) {
      const specifiers = find_export_specifiers(export_node);
      for (const spec of specifiers) {
        const info = extract_export_specifier_info(spec);
        if (info.name === symbol_name) {
          return {
            is_reexport: true,
            export_name: info.alias,
          };
        }
      }
      // Symbol not found in this re-export
      return undefined;
    }
    return { is_reexport: true };
  }

  // Check for named export with alias: export { foo as bar }
  // This only applies if we're checking a named export (not direct export)
  const specifiers = find_export_specifiers(export_node);
  if (specifiers.length > 0 && symbol_name) {
    // Look for this specific symbol in the export specifiers
    for (const spec of specifiers) {
      const info = extract_export_specifier_info(spec);
      if (info.name === symbol_name) {
        // Found! Return alias if present
        return info.alias ? { export_name: info.alias } : undefined;
      }
    }
    // Symbol not found in this export statement
    return undefined;
  }

  // Direct export with no special metadata: export function foo() {}
  return undefined;
}

/**
 * Check if a node is exported and extract export metadata
 * This handles:
 * 1. Direct exports: export function foo() {}
 * 2. Named exports: export { foo, bar as baz }
 * 3. Default exports: export default foo
 * 4. Re-exports: export { x } from './y'
 */
export function extract_export_info(
  node: SyntaxNode,
  symbol_name?: SymbolName
): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  let current: SyntaxNode | null = node;

  // First, check if this is a direct export: export function foo() {}
  // BUT: Stop if we enter a nested function/arrow function scope
  // Variables inside nested functions are NOT exported even if the outer const is exported
  while (current) {
    const parent: SyntaxNode | null = current.parent;

    if (parent?.type === "export_statement") {
      const export_metadata = analyze_export_statement(parent, symbol_name);
      return {
        is_exported: true,
        export: export_metadata,
      };
    }

    // Stop walking up if we're at a function body (statement_block inside a function)
    // This prevents marking variables inside nested functions as exported
    const is_inside_function_body =
      current.type === "statement_block" &&
      parent &&
      (parent.type === "function_declaration" ||
        parent.type === "function_expression" ||
        parent.type === "arrow_function" ||
        parent.type === "method_definition" ||
        parent.type === "generator_function_declaration" ||
        parent.type === "generator_function");

    if (is_inside_function_body) {
      // We're at a function body boundary - stop here
      // Variables inside this function should not inherit the outer export status
      break;
    }

    current = parent;
  }

  // Second, check if this symbol is exported via named export: export { foo }
  // We need to search the entire file for export statements that reference this symbol
  if (symbol_name) {
    const root = get_root_node(node);
    const named_export = find_named_export_for_symbol(root, symbol_name);
    if (named_export) {
      return {
        is_exported: true,
        export: named_export,
      };
    }

    // Third, check if this symbol is exported via CommonJS: module.exports = { foo }
    const commonjs_export = find_commonjs_export_for_symbol(root, symbol_name);
    if (commonjs_export) {
      return {
        is_exported: true,
        export: commonjs_export,
      };
    }
  }

  return { is_exported: false };
}

/**
 * Get the root (program) node
 */
function get_root_node(node: SyntaxNode): SyntaxNode {
  let current = node;
  while (current.parent) {
    current = current.parent;
  }
  return current;
}

/**
 * Find named export statement that exports the given symbol
 * Searches for: export { foo } or export { foo as bar }
 */
function find_named_export_for_symbol(
  root: SyntaxNode,
  symbol_name: SymbolName
): ExportMetadata | undefined {
  // Search all children of the root for export_statement nodes
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child?.type === "export_statement") {
      // Check if this export statement references our symbol
      const specifiers = find_export_specifiers(child);
      for (const spec of specifiers) {
        const info = extract_export_specifier_info(spec);
        if (info.name === symbol_name) {
          // Found it!
          const is_reexport = has_from_clause(child);
          return {
            export_name: info.alias,
            is_reexport,
          };
        }
      }
    }
  }

  return undefined;
}

/**
 * Find CommonJS export that exports the given symbol
 * Searches for: module.exports = { foo, bar }
 */
function find_commonjs_export_for_symbol(
  root: SyntaxNode,
  symbol_name: SymbolName
): ExportMetadata | undefined {
  // Search for assignment_expression nodes: module.exports = { ... }
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);

    // Check expression_statement nodes
    if (child?.type === "expression_statement") {
      const expr = child.child(0);

      if (expr?.type === "assignment_expression") {
        const left = expr.childForFieldName("left");
        const right = expr.childForFieldName("right");

        // Check if left side is module.exports
        if (left?.type === "member_expression") {
          const object = left.childForFieldName("object");
          const property = left.childForFieldName("property");

          if (object?.text === "module" && property?.text === "exports") {
            // Check if right side is an object containing our symbol
            if (right?.type === "object") {
              // Search through object properties
              for (let j = 0; j < right.childCount; j++) {
                const prop = right.child(j);

                // Handle shorthand properties: { helper }
                if (prop?.type === "shorthand_property_identifier") {
                  if (prop.text === symbol_name) {
                    return {}; // Found! No alias for CommonJS shorthand
                  }
                }

                // Handle full properties: { helper: helper }
                if (prop?.type === "pair") {
                  const key = prop.childForFieldName("key");
                  const value = prop.childForFieldName("value");

                  if (value?.type === "identifier" && value.text === symbol_name) {
                    // Export name is the key
                    const export_name = key?.type === "property_identifier" || key?.type === "identifier"
                      ? (key.text as SymbolName)
                      : undefined;

                    return export_name && export_name !== symbol_name
                      ? { export_name }
                      : {};
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return undefined;
}
