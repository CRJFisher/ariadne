/**
 * TypeScript-specific bespoke scope tree handlers
 * 
 * Handles TypeScript-specific features that cannot be expressed through configuration:
 * - Type-only imports and exports
 * - Ambient declarations (declare keyword)
 * - Type guards and type predicates
 * - Decorators and metadata
 * - Module augmentation
 */

import { SyntaxNode } from "tree-sitter";
import {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  ScopeId,
} from "@ariadnejs/types";
import {
  BespokeHandlers,
  GenericScopeContext,
  get_scope_chain,
} from "./scope_tree.generic";
import { create_javascript_handlers } from "./scope_tree.javascript.bespoke";

/**
 * TypeScript-specific context
 */
interface TypeScriptContext {
  in_ambient_context: boolean;
  in_type_only_context: boolean;
  type_imports: Set<string>;
  decorators: Map<string, string[]>;
  // Include JavaScript context
  in_strict_mode: boolean;
  hoisted_functions: Map<ScopeId, ScopeSymbol[]>;
  var_declarations: Map<ScopeId, ScopeSymbol[]>;
}

/**
 * Create TypeScript bespoke handlers
 */
export function create_typescript_handlers(): BespokeHandlers {
  // Start with JavaScript handlers as base
  const js_handlers = create_javascript_handlers();
  
  return {
    initialize_context: (root, source) => {
      const js_context = js_handlers.initialize_context!(root, source);
      return {
        ...js_context,
        in_ambient_context: check_ambient_context(root),
        in_type_only_context: false,
        type_imports: new Set(),
        decorators: new Map(),
      } as TypeScriptContext;
    },
    
    pre_process_node: (node, tree, context) => {
      // Apply JavaScript processing
      if (js_handlers.pre_process_node!(node, tree, context)) {
        return true;
      }
      
      return pre_process_typescript_node(node, tree, context);
    },
    
    extract_additional_symbols: (node, context) => {
      // Get JavaScript symbols first
      const js_symbols = js_handlers.extract_additional_symbols!(node, context);
      const ts_symbols = extract_typescript_symbols(node, context);
      return [...js_symbols, ...ts_symbols];
    },
    
    post_process: (tree, context) => {
      // Apply JavaScript post-processing first
      js_handlers.post_process!(tree, context);
      post_process_typescript(tree, context);
    },
    
    extract_scope_metadata: extract_typescript_metadata,
  };
}

/**
 * Check if in ambient context (d.ts file or declare)
 */
function check_ambient_context(node: SyntaxNode): boolean {
  // Check for declare keyword in children
  for (let i = 0; i < Math.min(10, node.childCount); i++) {
    const child = node.child(i);
    if (child && child.type === "declare") {
      return true;
    }
  }
  return false;
}

/**
 * Pre-process TypeScript-specific nodes
 */
function pre_process_typescript_node(
  node: SyntaxNode,
  tree: ScopeTree,
  context: GenericScopeContext
): boolean {
  const ts_context = context.language_context as TypeScriptContext;

  // Track type-only imports
  if (node.type === "import_statement") {
    const type_keyword = node.child(1);
    if (type_keyword && type_keyword.text === "type") {
      ts_context.in_type_only_context = true;
      
      // Extract import names
      const import_clause = node.childForFieldName("import_clause");
      if (import_clause) {
        extract_type_imports(import_clause, ts_context);
      }
    }
  }

  // Track decorators
  if (node.type === "decorator") {
    const parent = node.parent;
    if (parent) {
      const name_node = parent.childForFieldName("name");
      if (name_node) {
        const target_name = name_node.text;
        const decorator_name = extract_decorator_name(node, context.source_code);
        
        if (!ts_context.decorators.has(target_name)) {
          ts_context.decorators.set(target_name, []);
        }
        ts_context.decorators.get(target_name)!.push(decorator_name);
      }
    }
  }

  // Handle ambient declarations
  if (node.type === "ambient_declaration") {
    ts_context.in_ambient_context = true;
  }

  return false;
}

/**
 * Extract type imports
 */
function extract_type_imports(node: SyntaxNode, context: TypeScriptContext): void {
  const find_imports = (n: SyntaxNode) => {
    if (n.type === "identifier" || n.type === "type_identifier") {
      context.type_imports.add(n.text);
    }
    
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) find_imports(child);
    }
  };
  
  find_imports(node);
}

/**
 * Extract decorator name
 */
function extract_decorator_name(node: SyntaxNode, source: string): string {
  const start = node.startIndex + 1; // Skip @
  let end = node.endIndex;
  
  // Find the decorator name (before parentheses if any)
  const text = source.substring(start, end);
  const parenIndex = text.indexOf("(");
  if (parenIndex !== -1) {
    return text.substring(0, parenIndex);
  }
  return text;
}

/**
 * Extract additional TypeScript symbols
 */
function extract_typescript_symbols(
  node: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];
  const ts_context = context.language_context as TypeScriptContext;

  // Handle type aliases in objects
  if (node.type === "type_annotation") {
    // Type annotations don't create symbols but might reference them
    return symbols;
  }

  // Handle enum members
  if (node.type === "enum_member") {
    const name_node = node.childForFieldName("name");
    if (name_node) {
      symbols.push({
        name: name_node.text,
        kind: "variable",
        location: {
          file_path: context.file_path,
          line: name_node.startPosition.row + 1,
          column: name_node.startPosition.column + 1,
          end_line: name_node.endPosition.row + 1,
          end_column: name_node.endPosition.column + 1,
        },
        metadata: {
          is_enum_member: true,
        },
      });
    }
  }

  // Handle index signatures
  if (node.type === "index_signature") {
    const param = node.childForFieldName("parameter");
    if (param) {
      const identifier = param.childForFieldName("name");
      if (identifier) {
        symbols.push({
          name: identifier.text,
          kind: "parameter",
          location: {
            file_path: context.file_path,
            line: identifier.startPosition.row + 1,
            column: identifier.startPosition.column + 1,
            end_line: identifier.endPosition.row + 1,
            end_column: identifier.endPosition.column + 1,
          },
          metadata: {
            is_index_parameter: true,
          },
        });
      }
    }
  }

  // Handle mapped type parameters
  if (node.type === "mapped_type_clause") {
    const name_node = node.childForFieldName("name");
    if (name_node) {
      symbols.push({
        name: name_node.text,
        kind: "type",
        location: {
          file_path: context.file_path,
          line: name_node.startPosition.row + 1,
          column: name_node.startPosition.column + 1,
          end_line: name_node.endPosition.row + 1,
          end_column: name_node.endPosition.column + 1,
        },
        metadata: {
          is_mapped_type_parameter: true,
        },
      });
    }
  }

  return symbols;
}

/**
 * Post-process TypeScript tree
 */
function post_process_typescript(
  tree: ScopeTree,
  context: GenericScopeContext
): void {
  const ts_context = context.language_context as TypeScriptContext;

  // Mark type-only imports
  for (const [_, scope] of tree.nodes) {
    for (const [name, symbol] of scope.symbols) {
      if (ts_context.type_imports.has(name)) {
        symbol.metadata = {
          ...symbol.metadata,
          is_type_only: true,
        };
      }
    }
  }

  // Add decorator metadata to symbols
  for (const [name, decorators] of ts_context.decorators) {
    for (const [_, scope] of tree.nodes) {
      const symbol = scope.symbols.get(name);
      if (symbol) {
        symbol.metadata = {
          ...symbol.metadata,
          decorators,
        };
      }
    }
  }
}

/**
 * Extract TypeScript-specific scope metadata
 */
function extract_typescript_metadata(
  node: SyntaxNode,
  context: GenericScopeContext
): Record<string, any> {
  const ts_context = context.language_context as TypeScriptContext;
  const metadata: Record<string, any> = {};

  // Mark ambient scopes
  if (ts_context.in_ambient_context) {
    metadata.is_ambient = true;
  }

  // Mark type-only contexts
  if (node.type === "interface_declaration" || 
      node.type === "type_alias_declaration") {
    metadata.is_type_only = true;
  }

  // Mark async functions
  if (node.type === "function_declaration" || 
      node.type === "method_definition" ||
      node.type === "arrow_function") {
    const async_keyword = node.child(0);
    if (async_keyword && async_keyword.text === "async") {
      metadata.is_async = true;
    }
  }

  // Mark generic functions/classes
  if (node.childForFieldName("type_parameters")) {
    metadata.is_generic = true;
  }

  // Mark abstract classes/methods
  if (node.type === "class_declaration" || node.type === "method_definition") {
    const abstract_keyword = node.child(0);
    if (abstract_keyword && abstract_keyword.text === "abstract") {
      metadata.is_abstract = true;
    }
  }

  return metadata;
}

/**
 * Find enclosing namespace or module scope
 */
export function find_enclosing_module_scope(
  tree: ScopeTree,
  scope_id: ScopeId
): ScopeId | undefined {
  const chain = get_scope_chain(tree, scope_id);
  
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].type === "module") {
      return chain[i].id;
    }
  }
  
  return undefined;
}