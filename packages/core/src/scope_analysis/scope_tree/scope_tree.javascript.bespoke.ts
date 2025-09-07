/**
 * JavaScript-specific bespoke scope tree handlers
 * 
 * Handles JavaScript-specific features that cannot be expressed through configuration:
 * - Function hoisting
 * - var hoisting to function scope
 * - Strict mode detection
 * - Closure capture analysis
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
  find_symbol_in_scope_chain,
  get_scope_chain,
} from "./scope_tree.generic";
import { node_to_location } from "../../ast/node_utils";

/**
 * JavaScript-specific context
 */
interface JavaScriptContext {
  in_strict_mode: boolean;
  hoisted_functions: Map<ScopeId, ScopeSymbol[]>;
  var_declarations: Map<ScopeId, ScopeSymbol[]>;
}

/**
 * Create JavaScript bespoke handlers
 */
export function create_javascript_handlers(): BespokeHandlers {
  return {
    initialize_context,
    pre_process_node,
    should_create_scope: should_create_scope_override,
    extract_additional_symbols,
    extract_custom_parameters,
    post_process,
  };
}

/**
 * Initialize JavaScript-specific context
 */
function initialize_context(root: SyntaxNode, source: string): JavaScriptContext {
  return {
    in_strict_mode: check_strict_mode(root, source),
    hoisted_functions: new Map(),
    var_declarations: new Map(),
  };
}

/**
 * Check if code is in strict mode
 */
function check_strict_mode(node: SyntaxNode, source_code: string): boolean {
  // Look for "use strict" directive
  for (let i = 0; i < Math.min(5, node.childCount); i++) {
    const child = node.child(i);
    if (child && child.type === "expression_statement") {
      const expr = child.firstChild;
      if (expr && expr.type === "string") {
        const text = source_code.substring(expr.startIndex, expr.endIndex);
        if (text === '"use strict"' || text === "'use strict'") {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if a statement_block should create a scope
 */
function should_create_block_scope(node: SyntaxNode): boolean {
  if (node.type !== "statement_block") return false;
  
  const parent = node.parent;
  if (!parent) return true; // Top-level block
  
  // Don't create scope for function bodies (already handled by function scope)
  const isFunctionBody = 
    parent.type === "function_declaration" ||
    parent.type === "function_expression" ||
    parent.type === "arrow_function" ||
    parent.type === "method_definition" ||
    parent.type === "generator_function_declaration" ||
    parent.type === "generator_function";
  
  // Don't create scope for control flow bodies that already have their own scope
  const isControlFlowBody = 
    parent.type === "if_statement" ||
    parent.type === "for_statement" ||
    parent.type === "for_in_statement" ||
    parent.type === "for_of_statement" ||
    parent.type === "while_statement" ||
    parent.type === "do_statement" ||
    parent.type === "switch_statement" ||
    parent.type === "try_statement" ||
    parent.type === "catch_clause" ||
    parent.type === "finally_clause";
  
  return !isFunctionBody && !isControlFlowBody;
}

/**
 * Check if a node should create a scope (override for statement_block)
 */
function should_create_scope_override(
  node: SyntaxNode,
  context: GenericScopeContext
): boolean | undefined {
  if (node.type === "statement_block") {
    return should_create_block_scope(node);
  }
  return undefined; // Use default config for other nodes
}

/**
 * Pre-process node for JavaScript-specific handling
 */
function pre_process_node(
  node: SyntaxNode,
  tree: ScopeTree,
  context: GenericScopeContext
): boolean {
  const js_context = context.language_context as JavaScriptContext;

  // Track hoisted function declarations
  if (node.type === "function_declaration") {
    const name_node = node.childForFieldName("name");
    if (name_node) {
      const symbol: ScopeSymbol = {
        name: name_node.text,
        kind: "function",
        location: {
          file_path: context.file_path,
          line: name_node.startPosition.row + 1,
          column: name_node.startPosition.column + 1,
          end_line: name_node.endPosition.row + 1,
          end_column: name_node.endPosition.column + 1,
        },
      };

      // Find the enclosing function scope for hoisting
      const enclosing_function = find_enclosing_function_scope(tree, context.current_scope_id);
      const target_scope = enclosing_function || tree.root_id;

      if (!js_context.hoisted_functions.has(target_scope)) {
        js_context.hoisted_functions.set(target_scope, []);
      }
      js_context.hoisted_functions.get(target_scope)!.push(symbol);
    }
  }


  return false; // Continue with generic processing
}

/**
 * Extract additional JavaScript-specific symbols
 */
function extract_additional_symbols(
  node: SyntaxNode,
  context: GenericScopeContext
): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = [];
  const js_context = context.language_context as JavaScriptContext;

  // Handle variable_declarator with metadata
  if (node.type === "variable_declarator") {
    const parent = node.parent;
    
    // Check for both lexical_declaration (const/let) and variable_declaration (var)
    if (parent && (parent.type === "lexical_declaration" || parent.type === "variable_declaration")) {
      const kind_node = parent.firstChild;
      const declaration_type = kind_node?.text as "const" | "let" | "var";
      const name_node = node.childForFieldName("name");
      const value_node = node.childForFieldName("value");
      
      // For const and let, add them as regular symbols
      // var is handled separately for hoisting
      if (declaration_type === "const" || declaration_type === "let") {
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
              declaration_type,
              is_mutable: declaration_type !== "const",
              initial_value: value_node ? context.source_code.substring(value_node.startIndex, value_node.endIndex) : undefined,
            },
          });
        }
      }
    }
  }

  // Track var declarations for hoisting
  if (node.type === "variable_declaration") {
    const kind_node = node.firstChild;
    if (kind_node && kind_node.text === "var") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === "variable_declarator") {
          const name_node = child.childForFieldName("name");
          if (name_node && name_node.type === "identifier") {
            // Find the function scope this should be hoisted to
            const scope_chain = [];
            let current_id = context.current_scope_id;
            while (current_id) {
              scope_chain.push(current_id);
              // This is a hack - we need to find parent scope
              // But we can't access the tree here easily
              break;
            }
            
            // Store for later hoisting
            if (!js_context.var_declarations.has(context.current_scope_id)) {
              js_context.var_declarations.set(context.current_scope_id, []);
            }
            js_context.var_declarations.get(context.current_scope_id)!.push({
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
              declaration_type: "var",
              is_mutable: true,
              hoisted: true,
            },
            });
          }
        }
      }
    }
  }

  // Note: Named function expressions are handled in extract_custom_parameters
  // because they need to be added to the function's own scope, not the parent scope

  // Handle object method shorthand
  if (node.type === "shorthand_property_identifier") {
    symbols.push({
      name: node.text,
      kind: "variable",
      location: {
        file_path: context.file_path,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column + 1,
      },
    });
  }

  return symbols;
}

/**
 * Extract custom parameters for JavaScript functions
 */
function extract_custom_parameters(
  node: SyntaxNode,
  scope: ScopeNode,
  context: GenericScopeContext
): void {
  // Handle named function expressions - the name is available inside the function
  if (node.type === "function_expression") {
    const name_node = node.childForFieldName("name");
    if (name_node) {
      scope.symbols.set(name_node.text, {
        name: name_node.text,
        kind: "function",
        location: {
          file_path: context.file_path,
          line: name_node.startPosition.row + 1,
          column: name_node.startPosition.column + 1,
          end_line: name_node.endPosition.row + 1,
          end_column: name_node.endPosition.column + 1,
        },
        metadata: {
          is_self_reference: true,
        },
      });
    }
  }
}

/**
 * Post-process to apply hoisting
 */
function post_process(tree: ScopeTree, context: GenericScopeContext): void {
  const js_context = context.language_context as JavaScriptContext;

  // Apply function hoisting
  for (const [scope_id, symbols] of js_context.hoisted_functions) {
    const scope = tree.nodes.get(scope_id);
    if (scope) {
      for (const symbol of symbols) {
        // Functions are hoisted to the top of their scope
        const hoisted_symbol = {
          ...symbol,
          metadata: {
            ...symbol.metadata,
            hoisted: true,
          },
        };
        scope.symbols.set(symbol.name, hoisted_symbol);
      }
    }
  }

  // Apply var hoisting - vars hoist to function scope
  for (const [declaring_scope_id, symbols] of js_context.var_declarations) {
    // Find the function scope to hoist to
    let target_scope_id = declaring_scope_id;
    let current_scope = tree.nodes.get(declaring_scope_id);
    
    // Walk up to find function scope
    while (current_scope && current_scope.type !== "function" && current_scope.parent_id) {
      current_scope = tree.nodes.get(current_scope.parent_id);
      if (current_scope) {
        target_scope_id = current_scope.id;
        if (current_scope.type === "function") {
          break;
        }
      }
    }
    
    // If no function scope found, hoist to global
    if (!current_scope || current_scope.type !== "function") {
      target_scope_id = tree.root_id;
    }
    
    const target_scope = tree.nodes.get(target_scope_id);
    if (target_scope) {
      for (const symbol of symbols) {
        // Update existing symbol or add new one
        const existing_symbol = target_scope.symbols.get(symbol.name);
        if (existing_symbol) {
          // Update existing symbol with hoisted metadata
          const updated_symbol = {
            ...existing_symbol,
            metadata: {
              ...existing_symbol.metadata,
              hoisted: true,
              hoisted_from: declaring_scope_id !== target_scope_id ? declaring_scope_id : undefined,
            },
          };
          target_scope.symbols.set(symbol.name, updated_symbol);
        } else {
          // Add new symbol with metadata
          const hoisted_symbol = {
            ...symbol,
            metadata: {
              ...symbol.metadata,
              declaration_type: symbol.metadata?.declaration_type || "var",
              is_mutable: true,
              hoisted: true,
              hoisted_from: declaring_scope_id !== target_scope_id ? declaring_scope_id : undefined,
            },
          };
          target_scope.symbols.set(symbol.name, hoisted_symbol);
        }
      }
    }
  }
}

/**
 * Find enclosing function scope
 */
function find_enclosing_function_scope(
  tree: ScopeTree,
  scope_id: ScopeId
): ScopeId | undefined {
  const chain = get_scope_chain(tree, scope_id);
  
  // Skip the current scope (index 0)
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].type === "function") {
      return chain[i].id;
    }
  }
  
  return undefined;
}

/**
 * Check if a closure captures a variable
 */
export function check_closure_capture(
  tree: ScopeTree,
  closure_scope_id: ScopeId,
  variable_name: string
): boolean {
  // Check if variable is defined outside the closure
  const closure_scope = tree.nodes.get(closure_scope_id);
  if (!closure_scope) return false;

  // Variable not in closure scope itself
  if (closure_scope.symbols.has(variable_name)) {
    return false;
  }

  // Check if variable exists in parent scopes
  const symbol = find_symbol_in_scope_chain(tree, closure_scope_id, variable_name);
  return symbol !== undefined;
}