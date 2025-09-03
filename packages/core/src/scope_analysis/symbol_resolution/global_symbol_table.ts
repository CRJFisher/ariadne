/**
 * Global Symbol Table
 *
 * Builds and manages a unified symbol table from all file analyses.
 * This enables cross-file symbol resolution and reference tracking.
 */

import {
  SymbolId,
  FileAnalysis,
  ModuleGraph,
  Language,
  Location,
  FunctionDefinition,
  VariableDeclaration,
  FilePath,
  ImportName,
  ExportName,
  ClassDefinition,
  MethodDefinition,
} from "@ariadnejs/types";
import { TypeRegistry } from "../../type_analysis/type_registry";

/**
 * Symbol visibility levels
 */
export enum SymbolVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
  PROTECTED = "protected",
  INTERNAL = "internal",
}

/**
 * Symbol definition in the global table
 */
export interface SymbolDefinition {
  symbol_id: SymbolId;
  name: string;
  kind: "function" | "class" | "method" | "variable" | "type" | "namespace";
  location: Location;
  visibility: SymbolVisibility;
  is_exported: boolean;
  export_name?: string;
  metadata?: {
    parent_class?: string;
    is_static?: boolean;
    is_async?: boolean;
    is_generator?: boolean;
    is_abstract?: boolean;
  };
}

/**
 * Global symbol table structure
 */
export interface GlobalSymbolTable {
  symbols: Map<SymbolId, SymbolDefinition>;
  exports: Map<FilePath, Map<ExportName, SymbolId>>; // file → export name → symbol
  imports: Map<FilePath, Map<ImportName, SymbolId>>; // file → import name → symbol
  visibility: Map<SymbolId, SymbolVisibility>;
  references: Map<SymbolId, Location[]>; // symbol → usage locations
}

/**
 * Options for building the symbol table
 */
export interface SymbolTableOptions {
  analyses: FileAnalysis[];
  module_graph?: ModuleGraph;
  type_registry?: TypeRegistry;
  resolve_imports?: boolean;
  track_visibility?: boolean;
}

/**
 * Build a global symbol table from all file analyses
 */
export function build_symbol_table(
  options: SymbolTableOptions
): GlobalSymbolTable {
  const {
    analyses,
    module_graph,
    resolve_imports = true,
    track_visibility = true,
  } = options;

  const table: GlobalSymbolTable = {
    symbols: new Map(),
    exports: new Map(),
    imports: new Map(),
    visibility: new Map(),
    references: new Map(),
  };

  // Process each file analysis
  for (const analysis of analyses) {
    // Skip if no symbol registry (old analyses)
    const registry = (analysis as any).symbol_registry;
    if (!registry) continue;

    // Process functions
    for (const func of analysis.functions) {
      const symbol_id = registry.get(func);
      if (symbol_id) {
        add_function_to_table(table, func, symbol_id, analysis);
      }
    }

    // Process classes
    for (const cls of analysis.classes) {
      const symbol_id = registry.get(cls);
      if (symbol_id) {
        add_class_to_table(table, cls, symbol_id, analysis);

        // Process methods within the class
        for (const method of cls.methods) {
          const method_symbol_id = registry.get(method);
          if (method_symbol_id) {
            add_method_to_table(
              table,
              method,
              method_symbol_id,
              cls.name,
              analysis
            );
          }
        }
      }
    }

    // Process variables
    for (const variable of analysis.variables) {
      const symbol_id = registry.get(variable);
      if (symbol_id) {
        add_variable_to_table(table, variable, symbol_id, analysis);
      }
    }

    // Process exports
    process_exports(table, analysis);

    // Process imports
    if (resolve_imports && module_graph) {
      process_imports(table, analysis, module_graph);
    }
  }

  // Resolve import-export connections
  if (resolve_imports && module_graph) {
    resolve_import_export_connections(table, module_graph);
  }

  return table;
}

/**
 * Add a function to the symbol table
 */
function add_function_to_table(
  table: GlobalSymbolTable,
  func: FunctionDefinition,
  symbol_id: SymbolId,
  analysis: FileAnalysis
): void {
  const definition: SymbolDefinition = {
    symbol_id,
    name: func.name,
    kind: "function",
    location: func.location,
    visibility: SymbolVisibility.PUBLIC, // TODO: Detect actual visibility
    is_exported: check_if_exported(func.name, analysis),
    metadata: {
      is_async: func.signature.is_async,
      is_generator: func.signature.is_generator,
    },
  };

  table.symbols.set(symbol_id, definition);

  // Track visibility
  table.visibility.set(symbol_id, definition.visibility);
}

/**
 * Add a class to the symbol table
 */
function add_class_to_table(
  table: GlobalSymbolTable,
  cls: ClassDefinition,
  symbol_id: SymbolId,
  analysis: FileAnalysis
): void {
  const definition: SymbolDefinition = {
    symbol_id,
    name: cls.name,
    kind: "class",
    location: cls.location,
    visibility: SymbolVisibility.PUBLIC, // TODO: Detect actual visibility
    is_exported: cls.is_exported || check_if_exported(cls.name, analysis),
    metadata: {
      is_abstract: cls.is_abstract,
    },
  };

  table.symbols.set(symbol_id, definition);
  table.visibility.set(symbol_id, definition.visibility);
}

/**
 * Add a method to the symbol table
 */
function add_method_to_table(
  table: GlobalSymbolTable,
  method: MethodDefinition,
  symbol_id: SymbolId,
  class_name: string,
  analysis: FileAnalysis
): void {
  const definition: SymbolDefinition = {
    symbol_id,
    name: method.name,
    kind: "method",
    location: method.location,
    visibility: parse_visibility(method.visibility),
    is_exported: false, // Methods are exported through their class
    metadata: {
      parent_class: class_name,
      is_static: method.is_static,
      is_async: method.signature.is_async,
      is_generator: method.signature.is_generator,
      is_abstract: method.is_abstract,
    },
  };

  table.symbols.set(symbol_id, definition);
  table.visibility.set(symbol_id, definition.visibility);
}

/**
 * Add a variable to the symbol table
 */
function add_variable_to_table(
  table: GlobalSymbolTable,
  variable: VariableDeclaration,
  symbol_id: SymbolId,
  analysis: FileAnalysis
): void {
  const definition: SymbolDefinition = {
    symbol_id,
    name: variable.name,
    kind: "variable",
    location: variable.location,
    visibility: SymbolVisibility.PUBLIC, // TODO: Detect actual visibility
    is_exported: check_if_exported(variable.name, analysis),
  };

  table.symbols.set(symbol_id, definition);
  table.visibility.set(symbol_id, definition.visibility);
}

/**
 * Process exports from a file analysis
 */
function process_exports(
  table: GlobalSymbolTable,
  analysis: FileAnalysis
): void {
  const file_exports = new Map<string, SymbolId>();

  for (const exp of analysis.exports) {
    // Find the symbol for this export
    const symbol = find_symbol_by_name(exp.export_name, analysis);
    if (symbol) {
      file_exports.set(exp.name, symbol);

      // Mark symbol as exported
      const definition = table.symbols.get(symbol);
      if (definition) {
        definition.is_exported = true;
        definition.export_name = exp.name;
      }
    }
  }

  table.exports.set(analysis.file_path, file_exports);
}

/**
 * Process imports from a file analysis
 */
function process_imports(
  table: GlobalSymbolTable,
  analysis: FileAnalysis,
  module_graph: ModuleGraph
): void {
  const file_imports = new Map<string, SymbolId>();

  for (const imp of analysis.imports) {
    // Resolve the import path to actual file
    const resolved_path = resolve_import_path(
      imp.module_path,
      analysis.file_path,
      module_graph
    );
    if (resolved_path) {
      // Find the exported symbol in the target file
      const target_exports = table.exports.get(resolved_path);
      if (target_exports) {
        const symbol_id = target_exports.get(imp.name);
        if (symbol_id) {
          file_imports.set(imp.name, symbol_id);
        }
      }
    }
  }

  table.imports.set(analysis.file_path, file_imports);
}

/**
 * Resolve connections between imports and exports
 */
function resolve_import_export_connections(
  table: GlobalSymbolTable,
  module_graph: ModuleGraph
): void {
  // This would use the module graph to trace re-exports and aliases
  // For now, basic implementation is handled by process_imports
}

/**
 * Check if a symbol is exported
 */
function check_if_exported(name: string, analysis: FileAnalysis): boolean {
  return analysis.exports.some((exp) => exp.name === name);
}

/**
 * Find a symbol by name in a file analysis
 */
function find_symbol_by_name(
  name: string,
  analysis: FileAnalysis
): SymbolId | undefined {
  const registry = (analysis as any).symbol_registry;
  if (!registry) return undefined;

  // Search functions
  for (const func of analysis.functions) {
    if (func.name === name) {
      return registry.get(func);
    }
  }

  // Search classes
  for (const cls of analysis.classes) {
    if (cls.name === name) {
      return registry.get(cls);
    }
  }

  // Search variables
  for (const variable of analysis.variables) {
    if (variable.name === name) {
      return registry.get(variable);
    }
  }

  return undefined;
}

/**
 * Parse visibility string to enum
 */
function parse_visibility(visibility: string): SymbolVisibility {
  switch (visibility.toLowerCase()) {
    case "private":
      return SymbolVisibility.PRIVATE;
    case "protected":
      return SymbolVisibility.PROTECTED;
    case "internal":
      return SymbolVisibility.INTERNAL;
    default:
      return SymbolVisibility.PUBLIC;
  }
}

/**
 * Resolve import path to actual file path
 */
function resolve_import_path(
  import_path: string,
  from_file: string,
  module_graph: ModuleGraph
): string | undefined {
  // Use module graph to resolve the import
  // This is a simplified implementation
  const module = module_graph.modules.get(from_file);
  if (module) {
    for (const dep of module.dependencies) {
      if (dep.module_path === import_path) {
        return dep.resolved_path;
      }
    }
  }
  return undefined;
}

/**
 * Find all references to a symbol
 */
export function find_symbol_references(
  symbol_id: SymbolId,
  table: GlobalSymbolTable
): Location[] {
  return table.references.get(symbol_id) || [];
}

/**
 * Check if a symbol is visible from a given file
 */
export function is_symbol_visible_from_file(
  symbol_id: SymbolId,
  from_file: string,
  table: GlobalSymbolTable
): boolean {
  const definition = table.symbols.get(symbol_id);
  if (!definition) return false;

  // Same file - check visibility
  if (definition.file_path === from_file) {
    return true; // All symbols visible within same file
  }

  // Different file - must be exported and imported
  if (!definition.is_exported) {
    return false;
  }

  // Check if the file imports this symbol
  const file_imports = table.imports.get(from_file);
  if (file_imports) {
    return Array.from(file_imports.values()).includes(symbol_id);
  }

  return false;
}
