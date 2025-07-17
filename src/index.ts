import { Point, ScopeGraph, Def, Ref } from './graph';
import { build_scope_graph } from './scope_resolution';
import { find_all_references, find_definition } from './symbol_resolver';
import { LanguageConfig } from './types';
import { typescript_config } from './languages/typescript';
import { javascript_config } from './languages/javascript';
import { python_config } from './languages/python';
import { rust_config } from './languages/rust';
import { Edit } from './edit';
import { Tree } from 'tree-sitter';
import path from 'path';

// Re-export important types
export { Point, ScopeGraph, Def, Ref } from './graph';
export { Edit } from './edit';
export { LanguageConfig } from './types';

/**
 * Manages the code intelligence for an entire project.
 */
/**
 * Cached file data for incremental parsing
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph;
}

export class Project {
  private file_graphs: Map<string, ScopeGraph> = new Map();
  private file_cache: Map<string, FileCache> = new Map();
  private languages: Map<string, LanguageConfig> = new Map();

  constructor() {
    // Register available languages
    this.register_language(typescript_config);
    this.register_language(javascript_config);
    this.register_language(python_config);
    this.register_language(rust_config);
    // TODO: Add other languages as they are implemented
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

    const graph = build_scope_graph(tree, config);
    
    // Update caches
    this.file_graphs.set(file_path, graph);
    this.file_cache.set(file_path, {
      tree,
      source_code,
      graph,
    });
  }

  /**
   * Removes a file from the project.
   * @param file_path - The path of the file to remove.
   */
  remove_file(file_path: string) {
    this.file_graphs.delete(file_path);
    this.file_cache.delete(file_path);
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
  get_scope_graph(file_path: string): ScopeGraph | null {
    return this.file_graphs.get(file_path) || null;
  }

  /**
   * Get all scope graphs for the entire project.
   * Returns a map from file paths to their corresponding ScopeGraphs.
   * 
   * @returns Map of file paths to ScopeGraphs
   */
  get_all_scope_graphs(): Map<string, ScopeGraph> {
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
    
    return graph.getNodes('definition').filter(def => 
      def.symbol_kind === 'function' || 
      def.symbol_kind === 'method' ||
      def.symbol_kind === 'generator'
    );
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
      const functions = graph.getNodes('definition').filter(def => {
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
}