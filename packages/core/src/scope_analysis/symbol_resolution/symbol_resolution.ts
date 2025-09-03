/**
 * Symbol Resolution
 *
 * Resolves references to their definitions using the global symbol table
 * and scope-entity connections. This is the bridge between names in code
 * and their actual definitions across the codebase.
 * 
 * Also provides definition finding capabilities:
 * - Go to definition from references
 * - Find definition from imports
 * - Locate class/function/variable definitions
 * - Cross-file definition resolution
 */

import {
  SymbolId,
  ScopeId,
  Location,
  Language,
  FileAnalysis,
  FunctionCallInfo,
  MethodCallInfo,
  ConstructorCallInfo,
  VariableDeclaration,
  ImportStatement,
  ExportStatement,
  ScopeTree,
  ScopeNode,
  Def,
  Ref,
  Position,
  SymbolKind,
} from "@ariadnejs/types";
import { SyntaxNode } from 'tree-sitter';

import { GlobalSymbolTable, SymbolDefinition } from "./global_symbol_table";
import {
  ScopeEntityConnections,
  is_entity_visible_from_scope,
} from "../scope_entity_connections";
import {
  find_scope_at_position,
  get_scope_chain,
  get_visible_symbols,
} from "../scope_tree";
import {
  construct_symbol,
  construct_function_symbol,
  construct_method_symbol,
  construct_class_symbol,
  parse_symbol,
  get_symbol_file,
  get_symbol_name,
  SPECIAL_SYMBOLS,
} from "../../utils/symbol_construction";

/**
 * Result of resolving a reference to a definition
 */
export interface ResolvedReference {
  reference_location: Location;
  target_symbol: SymbolId;
  confidence: "exact" | "likely" | "possible";
  resolution_type: "local" | "import" | "global" | "fuzzy";
}

/**
 * Context for symbol resolution within a file
 */
export interface FileResolutionContext {
  file_analysis: FileAnalysis & {
    symbol_registry?: Map<any, SymbolId>;
    scope_entity_connections?: ScopeEntityConnections;
  };
  global_symbols: GlobalSymbolTable;
  imports_by_file: Map<string, readonly ImportStatement[]>;
  exports_by_file: Map<string, readonly ExportStatement[]>;
}

/**
 * Main entry point for symbol resolution
 *
 * Takes lists of entities that need resolving and returns maps of their
 * resolved SymbolIds. This connects all references to their definitions.
 */
export function resolve_all_symbols(
  analyses: FileAnalysis[],
  global_symbols: GlobalSymbolTable
): {
  resolved_calls: Map<Location, SymbolId>;
  resolved_methods: Map<Location, SymbolId>;
  resolved_constructors: Map<Location, SymbolId>;
  resolved_variables: Map<Location, SymbolId>;
  unresolved: Location[];
} {
  const resolved_calls = new Map<Location, SymbolId>();
  const resolved_methods = new Map<Location, SymbolId>();
  const resolved_constructors = new Map<Location, SymbolId>();
  const resolved_variables = new Map<Location, SymbolId>();
  const unresolved: Location[] = [];

  // Build import/export maps for cross-file resolution
  const imports_by_file = new Map<string, readonly ImportStatement[]>();
  const exports_by_file = new Map<string, readonly ExportStatement[]>();

  for (const analysis of analyses) {
    imports_by_file.set(analysis.file_path, analysis.imports);
    exports_by_file.set(analysis.file_path, analysis.exports);
  }

  // Process each file
  for (const analysis of analyses) {
    const extended_analysis = analysis as FileAnalysis & {
      symbol_registry?: Map<any, SymbolId>;
      scope_entity_connections?: ScopeEntityConnections;
    };

    const context: FileResolutionContext = {
      file_analysis: extended_analysis,
      global_symbols,
      imports_by_file,
      exports_by_file,
    };

    // Resolve function calls
    for (const call of analysis.function_calls) {
      const resolved = resolve_function_call(call, context);
      if (resolved) {
        resolved_calls.set(call.location, resolved);
      } else {
        unresolved.push(call.location);
      }
    }

    // Resolve method calls
    for (const call of analysis.method_calls) {
      const resolved = resolve_method_call(call, context);
      if (resolved) {
        resolved_methods.set(call.location, resolved);
      } else {
        unresolved.push(call.location);
      }
    }

    // Resolve constructor calls
    for (const call of analysis.constructor_calls) {
      const resolved = resolve_constructor_call(call, context);
      if (resolved) {
        resolved_constructors.set(call.location, resolved);
      } else {
        unresolved.push(call.location);
      }
    }

    // Resolve variable references (if we had them extracted)
    // TODO: Add variable reference extraction and resolution
  }

  return {
    resolved_calls,
    resolved_methods,
    resolved_constructors,
    resolved_variables,
    unresolved,
  };
}

/**
 * Resolve a function call to its definition
 */
export function resolve_function_call(
  call: FunctionCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis, global_symbols } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_position(
    file_analysis.scopes,
    call.location
  );

  if (!call_scope) return undefined;

  // Try different resolution strategies

  // 1. Check if it's a local function in the same file
  const local_symbol = resolve_local_function(
    call.callee_name,
    call_scope,
    file_analysis
  );
  if (local_symbol) return local_symbol;

  // 2. Check imports
  const imported_symbol = resolve_imported_function(
    call.callee_name,
    file_analysis.file_path,
    context
  );
  if (imported_symbol) return imported_symbol;

  // 3. Check global symbols (for same-file references)
  const global_symbol = resolve_in_global_table(
    call.callee_name,
    file_analysis.file_path,
    global_symbols
  );
  if (global_symbol) return global_symbol;

  // 4. Try fuzzy matching for possible typos
  const fuzzy_match = resolve_with_fuzzy_matching(
    call.callee_name,
    call_scope,
    file_analysis,
    global_symbols
  );
  if (fuzzy_match) return fuzzy_match;

  return undefined;
}

/**
 * Resolve a method call to its definition
 */
export function resolve_method_call(
  call: MethodCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis, global_symbols } = context;

  // If we have receiver name, try to infer its type
  if (call.receiver_name) {
    // TODO: Look up receiver_name in type map to get its type
    // For now, try to use receiver_name as class name directly
    const class_symbol = find_class_symbol(
      call.receiver_name,
      file_analysis.file_path,
      global_symbols
    );

    if (class_symbol) {
      // Construct the method symbol
      const method_symbol = construct_method_symbol(
        get_symbol_file(class_symbol),
        call.receiver_name,
        call.method_name,
        call.is_static_method
      );

      // Check if this method exists
      if (global_symbols.symbols.has(method_symbol)) {
        return method_symbol;
      }
    }
  }

  // Fallback: try to resolve as a function (could be a standalone function)
  const call_scope = find_scope_at_position(
    file_analysis.scopes,
    call.location
  );

  if (call_scope) {
    return resolve_local_function(call.method_name, call_scope, file_analysis);
  }

  return undefined;
}

/**
 * Resolve a constructor call to its class definition
 */
export function resolve_constructor_call(
  call: ConstructorCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis, global_symbols } = context;

  // Find the class symbol
  const class_symbol = find_class_symbol(
    call.constructor_name,
    file_analysis.file_path,
    global_symbols
  );

  return class_symbol;
}

/**
 * Resolve a local function within the same file
 */
function resolve_local_function(
  function_name: string,
  from_scope: ScopeNode,
  file_analysis: FileAnalysis & {
    symbol_registry?: Map<any, SymbolId>;
    scope_entity_connections?: ScopeEntityConnections;
  }
): SymbolId | undefined {
  const { scopes, scope_entity_connections, symbol_registry } = file_analysis;

  if (!scope_entity_connections || !symbol_registry) return undefined;

  // Walk up the scope chain looking for this function
  const scope_chain = get_scope_chain(scopes, from_scope.id);

  for (const scope of scope_chain) {
    const scope_contents = scope_entity_connections.scope_contents.get(
      scope.id
    );
    if (!scope_contents) continue;

    // Check functions in this scope
    for (const func_symbol of scope_contents.functions) {
      const parsed = parse_symbol(func_symbol);
      if (parsed.name === function_name) {
        // Check visibility
        if (
          is_entity_visible_from_scope(
            func_symbol,
            from_scope.id,
            scope_entity_connections,
            scopes
          )
        ) {
          return func_symbol;
        }
      }
    }
  }

  return undefined;
}

/**
 * Resolve an imported function
 */
function resolve_imported_function(
  function_name: string,
  from_file: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const imports = context.imports_by_file.get(from_file);
  if (!imports) return undefined;

  for (const import_stmt of imports) {
    // Check if the imported symbol matches
    if (import_stmt.symbol_name === function_name) {
      // Find the exported symbol in the source module
      const source_file = resolve_import_path(import_stmt.source, from_file);
      if (source_file) {
        const symbol = construct_function_symbol(
          source_file,
          import_stmt.symbol_name,
          undefined
        );

        // Check if this symbol exists and is exported
        const def = context.global_symbols.symbols.get(symbol);
        if (def && def.is_exported) {
          return symbol;
        }
      }
    }

    // Check namespace imports
    if (
      import_stmt.is_namespace_import &&
      import_stmt.namespace_name &&
      function_name.startsWith(import_stmt.namespace_name + ".")
    ) {
      const member_name = function_name.substring(
        import_stmt.namespace_name.length + 1
      );
      const source_file = resolve_import_path(import_stmt.source, from_file);

      if (source_file) {
        const symbol = construct_function_symbol(
          source_file,
          member_name,
          undefined
        );

        const def = context.global_symbols.symbols.get(symbol);
        if (def && def.is_exported) {
          return symbol;
        }
      }
    }
  }

  return undefined;
}

/**
 * Find a class symbol by name
 */
function find_class_symbol(
  class_name: string,
  from_file: string,
  global_symbols: GlobalSymbolTable
): SymbolId | undefined {
  // First try in the same file
  let symbol = construct_class_symbol(from_file, class_name);
  if (global_symbols.symbols.has(symbol)) {
    return symbol;
  }

  // Then check all files (for imported classes)
  // TODO: This should use import resolution
  for (const [sym_id, def] of global_symbols.symbols) {
    if (def.kind === "class" && def.name === class_name) {
      return sym_id;
    }
  }

  return undefined;
}

/**
 * Resolve in the global symbol table
 */
function resolve_in_global_table(
  name: string,
  file_path: string,
  global_symbols: GlobalSymbolTable
): SymbolId | undefined {
  // Try as a function first
  const func_symbol = construct_function_symbol(file_path, name);
  if (global_symbols.symbols.has(func_symbol)) {
    return func_symbol;
  }

  // Try as a class
  const class_symbol = construct_class_symbol(file_path, name);
  if (global_symbols.symbols.has(class_symbol)) {
    return class_symbol;
  }

  return undefined;
}

/**
 * Resolve with fuzzy matching for typos
 */
function resolve_with_fuzzy_matching(
  name: string,
  from_scope: ScopeNode,
  file_analysis: FileAnalysis & {
    scope_entity_connections?: ScopeEntityConnections;
  },
  global_symbols: GlobalSymbolTable
): SymbolId | undefined {
  const threshold = 0.8; // 80% similarity required
  let best_match: { symbol: SymbolId; score: number } | undefined;

  // Check all symbols in the global table
  for (const [symbol_id, def] of global_symbols.symbols) {
    const score = calculate_similarity(name, def.name);
    if (score > threshold) {
      if (!best_match || score > best_match.score) {
        // Check if this symbol is visible from the current scope
        if (file_analysis.scope_entity_connections) {
          const is_visible = is_entity_visible_from_scope(
            symbol_id,
            from_scope.id,
            file_analysis.scope_entity_connections,
            file_analysis.scopes
          );

          if (is_visible || def.is_exported) {
            best_match = { symbol: symbol_id, score };
          }
        }
      }
    }
  }

  return best_match?.symbol;
}

/**
 * Calculate string similarity (Levenshtein distance based)
 */
function calculate_similarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  // Create distance matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Calculate distances
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

/**
 * Resolve an import path to an actual file path
 */
function resolve_import_path(
  import_path: string,
  from_file: string
): string | undefined {
  // TODO: Implement proper module resolution
  // For now, just handle relative paths
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    const path = require("path");
    const dir = path.dirname(from_file);
    return path.resolve(dir, import_path).replace(/\\/g, "/");
  }

  return undefined;
}

/**
 * Check if a symbol is exported from its file
 */
export function is_symbol_exported(
  symbol_id: SymbolId,
  global_symbols: GlobalSymbolTable
): boolean {
  const def = global_symbols.symbols.get(symbol_id);
  return def?.is_exported || false;
}

/**
 * Find all references to a symbol
 */
export function find_symbol_references(
  symbol_id: SymbolId,
  analyses: FileAnalysis[]
): Location[] {
  const references: Location[] = [];
  const parsed = parse_symbol(symbol_id);
  const symbol_name = parsed.name;

  for (const analysis of analyses) {
    // Check function calls
    for (const call of analysis.function_calls) {
      if (call.callee_name === symbol_name) {
        references.push(call.location);
      }
    }

    // Check method calls
    for (const call of analysis.method_calls) {
      if (call.method_name === symbol_name) {
        references.push(call.location);
      }
    }

    // Check constructor calls
    for (const call of analysis.constructor_calls) {
      if (call.constructor_name === symbol_name) {
        references.push(call.location);
      }
    }
  }

  return references;
}

/**
 * Get definition location for a symbol
 */
export function get_symbol_definition(
  symbol_id: SymbolId,
  global_symbols: GlobalSymbolTable
): Location | undefined {
  const def = global_symbols.symbols.get(symbol_id);
  return def?.location;
}

// ============================================================================
// Definition Finding Features (merged from definition_finder)
// ============================================================================

/**
 * Definition search result
 */
export interface DefinitionResult {
  definition: Def;
  confidence: 'exact' | 'likely' | 'possible';
  source: 'local' | 'import' | 'external';
}

/**
 * Resolution context for definition finding
 */
export interface ResolutionContext {
  scope_tree: ScopeTree;
  language: Language;
  file_path: string;
  source_code?: string;
  root_node?: SyntaxNode;
}

/**
 * Resolved symbol type (for compatibility)
 */
export type ResolvedSymbol = DefinitionResult;

/**
 * Create resolution context
 */
export function create_resolution_context(
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string
): ResolutionContext {
  return {
    scope_tree,
    language,
    file_path,
    root_node,
    source_code
  };
}

/**
 * Go to definition from a position in code
 */
export function go_to_definition(
  position: Position,
  context: ResolutionContext
): Def | undefined {
  const result = find_definition_at_position(position, context);
  return result?.definition;
}

/**
 * Find definition at a given position
 */
export function find_definition_at_position(
  position: Position,
  context: ResolutionContext
): DefinitionResult | undefined {
  const { scope_tree } = context;
  
  // Find the scope at this position
  const scope = find_scope_at_position(scope_tree, position);
  if (!scope) return undefined;
  
  // Extract symbol name at position (would need AST access for real implementation)
  const symbol_name = extract_symbol_at_position(position, context);
  if (!symbol_name) return undefined;
  
  return find_symbol_definition(symbol_name, scope.id, context);
}

/**
 * Find definition for a symbol name
 */
export function find_symbol_definition(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): DefinitionResult | undefined {
  const { scope_tree, file_path } = context;
  
  // Try local scope chain first
  const local_def = find_local_definition(symbol_name, scope_id, scope_tree, file_path);
  if (local_def) return local_def;
  
  // TODO: Try imported definitions
  // TODO: Try cross-file definitions
  
  return undefined;
}

/**
 * Find local definition in scope chain
 */
function find_local_definition(
  symbol_name: string,
  scope_id: string,
  scope_tree: ScopeTree,
  file_path: string
): DefinitionResult | undefined {
  // Walk up the scope chain looking for the symbol
  const scope_chain = get_scope_chain(scope_tree, scope_id);
  
  for (const scope of scope_chain) {
    const symbol = scope.symbols.get(symbol_name);
    if (symbol && symbol.kind !== 'import' && symbol.kind !== 'export') {
      // Convert to Def
      const def: Def = {
        id: `def_${scope.id}_${symbol_name}`,
        kind: 'definition',
        name: symbol_name,
        symbol_kind: symbol.kind as SymbolKind,
        range: symbol.range,
        file_path
      };
      
      return {
        definition: def,
        confidence: 'exact',
        source: 'local'
      };
    }
  }
  
  return undefined;
}

/**
 * Extract symbol name at position
 * NOTE: This is a stub - real implementation would use AST
 */
function extract_symbol_at_position(
  position: Position,
  context: ResolutionContext
): string | undefined {
  // This would need actual AST traversal to find the identifier at position
  // For now, return undefined
  return undefined;
}

/**
 * Find all definitions in a scope tree
 */
export function find_all_definitions(
  scope_tree: ScopeTree,
  file_path: string
): Def[] {
  const definitions: Def[] = [];
  
  // Walk all scopes and collect definitions
  for (const [scope_id, scope] of scope_tree.nodes) {
    for (const [symbol_name, symbol] of scope.symbols) {
      // Skip imports and references
      if (symbol.kind === 'import' || symbol.kind === 'export') continue;
      
      const def: Def = {
        id: `def_${scope_id}_${symbol_name}`,
        kind: 'definition',
        name: symbol_name,
        symbol_kind: symbol.kind as SymbolKind,
        range: symbol.range,
        file_path
      };
      
      definitions.push(def);
    }
  }
  
  return definitions;
}

/**
 * Find definitions by kind
 */
export function find_definitions_by_kind(
  scope_tree: ScopeTree,
  kind: string,
  file_path: string
): Def[] {
  const definitions: Def[] = [];
  
  for (const [scope_id, scope] of scope_tree.nodes) {
    for (const [symbol_name, symbol] of scope.symbols) {
      if (symbol.kind === kind) {
        const def: Def = {
          id: `def_${scope_id}_${symbol_name}`,
          kind: 'definition',
          name: symbol_name,
          symbol_kind: symbol.kind as SymbolKind,
          range: symbol.range,
          file_path
        };
        
        definitions.push(def);
      }
    }
  }
  
  return definitions;
}

/**
 * Find exported definitions
 */
export function find_exported_definitions(
  scope_tree: ScopeTree,
  file_path: string
): Def[] {
  const definitions: Def[] = [];
  
  for (const [scope_id, scope] of scope_tree.nodes) {
    for (const [symbol_name, symbol] of scope.symbols) {
      if (symbol.is_exported) {
        const def: Def = {
          id: `def_${scope_id}_${symbol_name}`,
          kind: 'definition',
          name: symbol_name,
          symbol_kind: symbol.kind as SymbolKind,
          range: symbol.range,
          file_path
        };
        
        definitions.push(def);
      }
    }
  }
  
  return definitions;
}

/**
 * Check if a definition is visible from a scope
 */
export function is_definition_visible(
  def: Def,
  from_scope: string,
  scope_tree: ScopeTree
): boolean {
  // Simple visibility check - could be enhanced
  const scope_chain = get_scope_chain(scope_tree, from_scope);
  
  for (const scope of scope_chain) {
    const symbol = scope.symbols.get(def.name);
    if (symbol) return true;
  }
  
  return false;
}

/**
 * Go to definition from a reference
 */
export function go_to_definition_from_ref(
  ref: Ref,
  context: ResolutionContext
): Def | undefined {
  // Find the scope where the reference occurs
  const scope = find_scope_at_position(context.scope_tree, ref.range.start);
  if (!scope) return undefined;
  
  const result = find_symbol_definition(ref.name, scope.id, context);
  return result?.definition;
}

/**
 * Find definition candidates (for autocomplete/suggestions)
 */
export function find_definition_candidates(
  prefix: string,
  scope_id: string,
  context: ResolutionContext
): Def[] {
  const candidates: Def[] = [];
  const { scope_tree, file_path } = context;
  
  // Get all visible symbols from scope
  const visible_symbols = get_visible_symbols(scope_tree, scope_id);
  
  for (const [symbol_name, symbol] of visible_symbols) {
    if (symbol_name.startsWith(prefix)) {
      const def: Def = {
        id: `def_${scope_id}_${symbol_name}`,
        kind: 'definition',
        name: symbol_name,
        symbol_kind: symbol.kind as SymbolKind,
        range: symbol.range,
        file_path
      };
      
      candidates.push(def);
    }
  }
  
  return candidates;
}

/**
 * Get all visible symbols from a scope
 */
export function get_all_visible_symbols(
  scope_tree: ScopeTree,
  scope_id: string
): Map<string, any> {
  return get_visible_symbols(scope_tree, scope_id);
}

/**
 * Resolve symbol at position
 */
export function resolve_symbol_at_position(
  position: Position,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  return find_definition_at_position(position, context);
}

/**
 * Resolve symbol
 */
export function resolve_symbol(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  return find_symbol_definition(symbol_name, scope_id, context);
}

/**
 * Resolve symbol with type information
 */
export function resolve_symbol_with_type(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  // For now, same as resolve_symbol
  // Type information could be added later
  return find_symbol_definition(symbol_name, scope_id, context);
}
