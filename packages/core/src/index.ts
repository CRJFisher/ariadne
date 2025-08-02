import { Point, Def, Ref, FunctionCall, ImportInfo, SimpleRange, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call, IScopeGraph } from './graph';
import { ScopeGraph } from './graph'; // Internal use only
import { build_scope_graph } from './scope_resolution';
import { find_all_references, find_definition } from './symbol_resolver';
import { LanguageConfig } from './types';
import { typescript_config } from './languages/typescript';
import { javascript_config } from './languages/javascript';
import { python_config } from './languages/python';
import { rust_config } from './languages/rust';
import { Edit } from './edit';
import { Tree } from 'tree-sitter';
import { ClassRelationship, extract_class_relationships } from './inheritance';
import { ProjectCallGraph } from './project_call_graph';
import { ProjectSource } from './project_source';
import { ProjectInheritance } from './project_inheritance';
import path from 'path';

// Re-export important types
export { Point, Def, Ref, FunctionCall, SimpleRange, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call, IScopeGraph } from './graph';
export type { Import } from '@ariadnejs/types';
export { Edit } from './edit';
export { get_symbol_id, parse_symbol_id, normalize_module_path } from './symbol_naming';
export { ClassRelationship } from './inheritance';

/**
 * Manages the code intelligence for an entire project.
 */
/**
 * Cached file data for incremental parsing
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph; // Internal use - not exposed in public API
}

export class Project {
  private file_graphs: Map<string, ScopeGraph> = new Map();
  private file_cache: Map<string, FileCache> = new Map();
  private languages: Map<string, LanguageConfig> = new Map();
  private inheritance_map: Map<string, ClassRelationship> = new Map();
  private call_graph: ProjectCallGraph;
  private source: ProjectSource;
  private inheritance!: ProjectInheritance; // Initialized after constructor

  constructor() {
    // Register available languages
    this.register_language(typescript_config);
    this.register_language(javascript_config);
    this.register_language(python_config);
    this.register_language(rust_config);
    // TODO: Add other languages as they are implemented
    
    // Initialize helper classes with dependencies
    this.call_graph = new ProjectCallGraph(this.file_graphs, this.file_cache, this.languages);
    this.source = new ProjectSource(this.file_cache, this.languages);
    
    // Initialize inheritance with empty map - will be updated when files are added
    const fileGraphsWithContent = new Map<string, { graph: ScopeGraph; content: string; tree: Tree }>();
    this.inheritance = new ProjectInheritance(fileGraphsWithContent, this.inheritance_map, this.languages);
    
    // Set up delegation methods
    this.call_graph.set_go_to_definition_delegate((file_path: string, position: Point) => 
      this.go_to_definition(file_path, position)
    );
    this.call_graph.set_get_imports_with_definitions_delegate((file_path: string) => 
      this.get_imports_with_definitions(file_path)
    );
    this.call_graph.set_get_all_functions_delegate((options) => 
      this.get_all_functions(options)
    );
  }

  /**
   * Register a language configuration
   */
  private register_language(config: LanguageConfig) {
    this.languages.set(config.name, config);
    // Also register by file extensions for easy lookup
    for (const ext of config.file_extensions) {
      this.languages.set(ext, config);
    }
  }

  /**
   * Get language configuration for a file
   */
  private get_language_config(file_path: string): LanguageConfig | null {
    const ext = path.extname(file_path).slice(1); // Remove the dot
    return this.languages.get(ext) || null;
  }

  /**
   * Adds a file to the project or updates it if it already exists.
   * @param file_path - The unique path identifying the file.
   * @param source_code - The source code of the file.
   * @param edit - Optional edit information for incremental parsing
   */
  add_or_update_file(file_path: string, source_code: string, edit?: Edit) {
    const config = this.get_language_config(file_path);
    if (!config) {
      console.warn(`No language configuration found for file: ${file_path}`);
      return;
    }
    
    // Clear type tracking for this file since it's being updated
    this.call_graph.clearFileTypeTracker(file_path);

    const cached = this.file_cache.get(file_path);
    let tree: Tree;

    if (cached && edit) {
      // Incremental parsing
      cached.tree.edit({
        startIndex: edit.start_byte,
        oldEndIndex: edit.old_end_byte,
        newEndIndex: edit.new_end_byte,
        startPosition: edit.start_position,
        oldEndPosition: edit.old_end_position,
        newEndPosition: edit.new_end_position,
      });
      
      tree = config.parser.parse(source_code, cached.tree);
    } else {
      // Full parsing
      // Set a longer timeout for CI environments
      const oldTimeout = config.parser.getTimeoutMicros();
      config.parser.setTimeoutMicros(10000000); // 10 seconds
      
      try {
        tree = config.parser.parse(source_code);
      } finally {
        // Restore original timeout
        config.parser.setTimeoutMicros(oldTimeout);
      }
    }

    // Handle edge case where parse returns a tree without rootNode
    if (!tree) {
      console.error(`Parser returned null tree for ${file_path} with ${config.name} parser`);
      return;
    }
    
    if (!tree.rootNode) {
      // This typically means parsing timed out
      console.error(`Parse timeout for ${file_path} with ${config.name} parser`);
      console.error(`Source code length: ${source_code.length}`);
      console.error(`Try increasing parser timeout or check if language files are properly loaded`);
      
      // Try to parse a simple test to see if the parser works at all
      const testCode = config.name === 'python' ? 'x = 1' : 'var x = 1';
      const testTree = config.parser.parse(testCode);
      console.error(`Test parse result: ${testTree ? 'tree exists' : 'no tree'}, rootNode: ${testTree?.rootNode ? 'exists' : 'missing'}`);
      
      return;
    }

    const graph = build_scope_graph(tree, config, file_path, source_code);
    
    // Update caches
    this.file_graphs.set(file_path, graph);
    this.file_cache.set(file_path, {
      tree,
      source_code,
      graph,
    });
    
    // Update inheritance file info map
    const file_info_map = new Map<string, { graph: ScopeGraph; content: string; tree: Tree }>();
    for (const [path, cache] of this.file_cache) {
      file_info_map.set(path, {
        graph: cache.graph,
        content: cache.source_code,
        tree: cache.tree
      });
    }
    this.inheritance = new ProjectInheritance(file_info_map, this.inheritance_map, this.languages);
  }

  /**
   * Removes a file from the project.
   * @param file_path - The path of the file to remove.
   */
  remove_file(file_path: string) {
    this.file_graphs.delete(file_path);
    this.file_cache.delete(file_path);
    
    // Update inheritance file info map
    const file_info_map = new Map<string, { graph: ScopeGraph; content: string; tree: Tree }>();
    for (const [path, cache] of this.file_cache) {
      file_info_map.set(path, {
        graph: cache.graph,
        content: cache.source_code,
        tree: cache.tree
      });
    }
    this.inheritance = new ProjectInheritance(file_info_map, this.inheritance_map, this.languages);
  }

  /**
   * Updates a file with a text change at a specific position.
   * This is a convenience method that calculates the edit automatically.
   * @param file_path - The path of the file to update
   * @param start_position - The position where the change starts
   * @param old_text - The text being replaced
   * @param new_text - The new text
   */
  update_file_range(
    file_path: string,
    start_position: Point,
    old_text: string,
    new_text: string
  ) {
    const cached = this.file_cache.get(file_path);
    if (!cached) {
      console.warn(`No cached data for incremental update of ${file_path}`);
      return;
    }

    // Calculate byte offset from position
    let byte_offset = 0;
    let current_row = 0;
    let current_col = 0;
    
    for (let i = 0; i <= cached.source_code.length; i++) {
      if (current_row === start_position.row && current_col === start_position.column) {
        byte_offset = i;
        break;
      }
      
      if (i < cached.source_code.length && cached.source_code[i] === '\n') {
        current_row++;
        current_col = 0;
      } else {
        current_col++;
      }
    }

    // Calculate end positions
    const old_end_position = this.calculate_end_position(start_position, old_text);
    const new_end_position = this.calculate_end_position(start_position, new_text);

    const edit: Edit = {
      start_byte: byte_offset,
      old_end_byte: byte_offset + Buffer.from(old_text).length,
      new_end_byte: byte_offset + Buffer.from(new_text).length,
      start_position,
      old_end_position,
      new_end_position,
    };

    // Apply the edit
    const new_source = 
      cached.source_code.slice(0, byte_offset) +
      new_text +
      cached.source_code.slice(byte_offset + old_text.length);

    this.add_or_update_file(file_path, new_source, edit);
  }

  /**
   * Helper to calculate end position given start position and text
   */
  private calculate_end_position(start: Point, text: string): Point {
    let row = start.row;
    let column = start.column;
    
    for (const char of text) {
      if (char === '\n') {
        row++;
        column = 0;
      } else {
        column++;
      }
    }
    
    return { row, column };
  }

  /**
   * Finds all references to a symbol at a given position in a file.
   * @param file_path - The path of the file containing the symbol.
   * @param position - The row and column of the symbol.
   * @returns An array of locations where the symbol is referenced.
   */
  find_references(file_path: string, position: Point): Ref[] {
    return find_all_references(file_path, position, this.file_graphs);
  }

  /**
   * Finds the definition of a symbol at a given position in a file.
   * @param file_path - The path of the file containing the symbol.
   * @param position - The row and column of the symbol.
   * @returns The location of the symbol's definition, or null if not found.
   */
  go_to_definition(file_path: string, position: Point): Def | null {
    return find_definition(file_path, position, this.file_graphs);
  }

  /**
   * Get the scope graph for a specific file.
   * Returns null if the file doesn't exist or hasn't been indexed.
   * 
   * @param file_path - Path to the file relative to project root
   * @returns The ScopeGraph for the file or null if not found
   */
  get_scope_graph(file_path: string): IScopeGraph | null {
    return this.file_graphs.get(file_path) || null;
  }

  /**
   * Get all scope graphs for the entire project.
   * Returns a map from file paths to their corresponding ScopeGraphs.
   * 
   * @returns Map of file paths to ScopeGraphs
   */
  get_all_scope_graphs(): Map<string, IScopeGraph> {
    // Return a copy to prevent external modifications
    return new Map(this.file_graphs);
  }

  /**
   * Get all function and method definitions in a file.
   * 
   * @param file_path - Path to the file relative to project root
   * @returns Array of function/method definitions in the file
   */
  get_functions_in_file(file_path: string): Def[] {
    const graph = this.file_graphs.get(file_path);
    if (!graph) return [];
    
    return graph.getNodes<Def>('definition').filter(def => 
      def.symbol_kind === 'function' || 
      def.symbol_kind === 'method' ||
      def.symbol_kind === 'generator'
    );
  }

  /**
   * Get all definitions in a file.
   * 
   * @param file_path - Path to the file relative to project root
   * @returns Array of all definitions in the file (functions, methods, classes, variables, etc.)
   */
  get_definitions(file_path: string): Def[] {
    const graph = this.file_graphs.get(file_path);
    if (!graph) return [];
    
    // Return all definitions, let the caller filter by symbol_kind if needed
    return graph.getNodes<Def>('definition');
  }

  /**
   * Get all functions across the project with optional filtering.
   * 
   * @param options - Filtering options
   * @returns Map of file paths to arrays of function definitions
   */
  get_all_functions(options?: {
    include_private?: boolean;
    include_tests?: boolean;
    symbol_kinds?: string[];
  }): Map<string, Def[]> {
    const {
      include_private = true,
      include_tests = true,
      symbol_kinds = ['function', 'method', 'generator']
    } = options || {};
    
    const result = new Map<string, Def[]>();
    
    for (const [file_path, graph] of this.file_graphs) {
      const functions = graph.getNodes<Def>('definition').filter(def => {
        // Check symbol kind
        if (!symbol_kinds.includes(def.symbol_kind)) return false;
        
        // Filter private functions
        if (!include_private && this.is_private_function(def)) return false;
        
        // Filter test functions
        if (!include_tests && this.is_test_function(def)) return false;
        
        return true;
      });
      
      if (functions.length > 0) {
        result.set(file_path, functions);
      }
    }
    
    return result;
  }

  /**
   * Check if a function is private (starts with underscore).
   */
  private is_private_function(def: Def): boolean {
    return def.name.startsWith('_') && !def.name.startsWith('__');
  }

  /**
   * Check if a function is a test function.
   */
  private is_test_function(def: Def): boolean {
    const name = def.name.toLowerCase();
    return name.startsWith('test') || 
           name.startsWith('test_') || 
           name.includes('_test') ||
           name === 'setup' ||
           name === 'teardown';
  }

  /**
   * Get all calls (function, method, and constructor) made from within a definition's body.
   * Works with any definition type including functions, methods, classes, and blocks.
   * 
   * @param def - The definition to analyze
   * @returns Array of FunctionCall objects representing calls made within this definition
   */
  get_calls_from_definition(def: Def): FunctionCall[] {
    return this.call_graph.get_calls_from_definition(def);
  }

  /**
   * Get all function calls made by a specific function.
   * 
   * @param def - The function definition to analyze
   * @returns Array of FunctionCall objects representing calls made by this function
   */
  get_function_calls(def: Def): FunctionCall[] {
    if (!['function', 'method', 'generator'].includes(def.symbol_kind)) {
      return [];
    }
    
    // Use get_calls_from_definition and filter to only function/method/generator calls
    return this.get_calls_from_definition(def).filter(call => 
      ['function', 'method', 'generator'].includes(call.called_def.symbol_kind)
    );
  }

  /**
   * Get all function call relationships in the project.
   * 
   * @returns Object containing all functions and their call relationships
   */
  extract_call_graph(): {
    functions: Def[];
    calls: FunctionCall[];
  } {
    return this.call_graph.extract_call_graph();
  }

  /**
   * Build a complete call graph for the project.
   * 
   * This high-level API constructs a full call graph with nodes representing
   * functions/methods and edges representing call relationships. It handles
   * cross-file imports and provides various filtering options.
   * 
   * @param options - Options to control call graph generation
   * @returns Complete call graph with nodes, edges, and top-level functions
   */
  get_call_graph(options?: CallGraphOptions): CallGraph {
    return this.call_graph.get_call_graph(options);
  }



  /**
   * Get the source code for a definition.
   * 
   * @param def - The definition to extract source for
   * @param file_path - The path of the file containing the definition
   * @returns The exact source code for the definition
   */
  get_source_code(def: Def, file_path: string): string {
    return this.source.get_source_code(def, file_path);
  }

  /**
   * Get the source code with context for a definition.
   * Includes docstrings and decorators where applicable.
   * 
   * @param def - The definition to extract source for
   * @param file_path - The path of the file containing the definition
   * @param context_lines - Number of lines of context to include (default: 0)
   * @returns Object containing source, docstring, and decorators
   */
  get_source_with_context(def: Def, file_path: string, context_lines: number = 0): {
    source: string;
    docstring?: string;
    decorators?: string[];
  } {
    return this.source.get_source_with_context(def, file_path, context_lines);
  }

  /**
   * Get all imports in a file with their resolved definitions.
   * This enables cross-file call graph construction by mapping imports to actual functions.
   * 
   * @param file_path - The file to analyze imports for
   * @returns Array of ImportInfo objects containing import statements and their definitions
   */
  get_imports_with_definitions(file_path: string): ImportInfo[] {
    const graph = this.file_graphs.get(file_path);
    if (!graph) return [];
    
    const imports = graph.getAllImports();
    const importInfos: ImportInfo[] = [];
    
    for (const imp of imports) {
      // Use source_name if available (for renamed imports), otherwise use the import name
      const export_name = imp.source_name || imp.name;
      
      // Find the exported definition in other files
      // TODO: Implement proper module path resolution instead of searching all files
      for (const [otherFile, otherGraph] of this.file_graphs) {
        if (otherFile === file_path) continue;
        
        const exportedDef = otherGraph.findExportedDef(export_name);
        if (exportedDef) {
          importInfos.push({
            imported_function: exportedDef,
            import_statement: imp,
            local_name: imp.name
          });
          break; // Found the definition, stop searching
        }
      }
    }
    
    return importInfos;
  }

  /**
   * Get all functions exported from a specific module.
   * Note: Currently returns all root-level functions, as the scope mechanism
   * doesn't distinguish between exported and non-exported definitions.
   * In TypeScript/JavaScript, this includes both exported and non-exported functions.
   * In Python, all root-level functions are considered "exported".
   * 
   * @param module_path - The path to the module file
   * @returns Array of function definitions in the root scope
   */
  get_exported_functions(module_path: string): Def[] {
    const graph = this.file_graphs.get(module_path);
    if (!graph) return [];
    
    const exportedFunctions: Def[] = [];
    const allDefs = graph.getNodes<Def>('definition');
    
    // Filter to only functions/generators that are exported
    for (const def of allDefs) {
      // Include functions and generators, but exclude methods
      if (['function', 'generator'].includes(def.symbol_kind)) {
        // Skip methods (they have symbol_kind 'method' or have class_name in metadata)
        if (def.metadata?.class_name) {
          continue;
        }
        
        // Check if this definition is exported (findExportedDef returns it)
        const exportedDef = graph.findExportedDef(def.name);
        if (exportedDef && exportedDef.id === def.id) {
          exportedFunctions.push(def);
        }
      } else if (def.symbol_kind === 'method') {
        // Methods are tracked separately with symbol_kind 'method'
        // Skip them for this API which only returns standalone functions
        continue;
      }
    }
    
    return exportedFunctions;
  }

  /**
   * Get inheritance information for a class definition.
   * Returns parent class and implemented interfaces.
   * 
   * @param class_def - The class definition to analyze
   * @returns Class relationship info or null if not a class
   */
  get_class_relationships(class_def: Def): ClassRelationship | null {
    return this.inheritance.get_class_relationships(class_def);
  }

  /**
   * Find all classes that extend a given class.
   * 
   * @param parent_class - The parent class definition
   * @returns Array of subclass definitions
   */
  find_subclasses(parent_class: Def): Def[] {
    return this.inheritance.find_subclasses(parent_class);
  }

  /**
   * Find all classes that implement a given interface.
   * 
   * @param interface_def - The interface definition
   * @returns Array of implementing class definitions
   */
  find_implementations(interface_def: Def): Def[] {
    return this.inheritance.find_implementations(interface_def);
  }

  /**
   * Get the complete inheritance chain for a class.
   * Returns all ancestor classes in order from immediate parent to root.
   * 
   * @param class_def - The class definition
   * @returns Array of ancestor class definitions
   */
  get_inheritance_chain(class_def: Def): Def[] {
    return this.inheritance.get_inheritance_chain(class_def);
  }

  /**
   * Check if one class is a subclass of another.
   * 
   * @param child - The potential child class
   * @param parent - The potential parent class
   * @returns True if child inherits from parent
   */
  is_subclass_of(child: Def, parent: Def): boolean {
    return this.inheritance.is_subclass_of(child, parent);
  }
}

/**
 * Get all definitions in a file.
 * 
 * @param file_path - Path to the file to analyze
 * @returns Array of all definitions in the file (functions, methods, classes, variables, etc.)
 */
export function get_definitions(file_path: string): Def[] {
  // Create a temporary project instance to parse the file
  const project = new Project();
  
  // Read the file content
  const fs = require('fs');
  let source_code: string;
  try {
    source_code = fs.readFileSync(file_path, 'utf8');
  } catch (error) {
    console.error(`Failed to read file: ${file_path}`);
    return [];
  }
  
  // Add the file to the project
  project.add_or_update_file(file_path, source_code);
  
  // Get definitions from the project
  return project.get_definitions(file_path);
}

/**
 * Build a complete call graph for a project or set of files.
 * 
 * This is a convenience function that creates a temporary Project instance
 * and builds the call graph. For better performance when analyzing multiple
 * aspects of a codebase, create a Project instance and reuse it.
 * 
 * @param root_path - Root directory to analyze
 * @param options - Options to control call graph generation
 * @returns Complete call graph with nodes, edges, and top-level functions
 */
export function get_call_graph(root_path: string, options?: CallGraphOptions): CallGraph {
  const project = new Project();
  const fs = require('fs');
  const path = require('path');
  
  // Helper function to recursively find all source files
  function find_source_files(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip common directories
        if (['node_modules', '.git', '__pycache__', 'target', 'dist', 'build'].includes(entry.name)) {
          continue;
        }
        files.push(...find_source_files(fullPath));
      } else if (entry.isFile()) {
        // Check if it's a supported source file
        const ext = path.extname(entry.name);
        if (['.js', '.jsx', '.ts', '.tsx', '.py', '.rs'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }
  
  // Find and add all source files
  const sourceFiles = find_source_files(root_path);
  
  for (const filePath of sourceFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      project.add_or_update_file(filePath, content);
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`, error);
    }
  }
  
  // Build and return the call graph
  return project.get_call_graph(options);
}