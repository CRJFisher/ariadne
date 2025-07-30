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
import path from 'path';

// Re-export important types
export { Point, Def, Ref, Import, FunctionCall, SimpleRange, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call, IScopeGraph } from './graph';
export { Edit } from './edit';
export { get_symbol_id, parse_symbol_id, normalize_module_path } from './symbol_naming';

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

    const graph = build_scope_graph(tree, config, file_path, source_code);
    
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
    const graph = this.file_graphs.get(def.file_path);
    const fileCache = this.file_cache.get(def.file_path);
    if (!graph || !fileCache) return [];
    
    const calls: FunctionCall[] = [];
    
    // Find the full definition body range using AST traversal
    let definitionRange = def.range;
    
    // Find the AST node for this definition
    const defNode = fileCache.tree.rootNode.descendantForPosition(
      { row: def.range.start.row, column: def.range.start.column },
      { row: def.range.end.row, column: def.range.end.column }
    );
    
    if (defNode) {
      // Walk up the tree to find the full definition node based on symbol_kind
      let current = defNode.parent;
      while (current) {
        const nodeType = current.type;
        let foundDefinitionNode = false;
        
        // Check for function/method nodes
        if (['function', 'method', 'generator'].includes(def.symbol_kind)) {
          if (nodeType === 'function_declaration' ||
              nodeType === 'method_definition' ||
              nodeType === 'generator_function_declaration' ||
              nodeType === 'function_expression' ||
              nodeType === 'arrow_function' ||
              nodeType === 'function_definition' || // Python
              nodeType === 'decorated_definition' || // Python with decorators
              nodeType === 'function_item') { // Rust
            foundDefinitionNode = true;
          }
        }
        // Check for class nodes
        else if (def.symbol_kind === 'class') {
          if (nodeType === 'class_declaration' ||
              nodeType === 'class_definition' || // Python
              nodeType === 'struct_item' || // Rust
              nodeType === 'impl_item') { // Rust
            foundDefinitionNode = true;
          }
        }
        // Check for variable/const nodes that might have initializers
        else if (['variable', 'const', 'let', 'constant'].includes(def.symbol_kind)) {
          if (nodeType === 'variable_declarator') {
            // For variable declarator, use its range which includes the initializer
            foundDefinitionNode = true;
          } else if (nodeType === 'variable_declaration' ||
                     nodeType === 'lexical_declaration' ||
                     nodeType === 'assignment' || // Python
                     nodeType === 'let_declaration' || // Rust
                     nodeType === 'const_item') { // Rust
            foundDefinitionNode = true;
          }
        }
        
        if (foundDefinitionNode) {
          // Found the definition node, use its range
          definitionRange = {
            start: { row: current.startPosition.row, column: current.startPosition.column },
            end: { row: current.endPosition.row, column: current.endPosition.column }
          };
          break;
        }
        current = current.parent;
      }
    }
    
    // Get all references in this file
    const refs = graph.getNodes<Ref>('reference');
    
    // Filter to only refs within this definition's range
    const definitionRefs = refs.filter(ref => 
      this.is_position_within_range(ref.range.start, definitionRange) &&
      this.is_position_within_range(ref.range.end, definitionRange)
    );
    
    // For each reference, try to resolve it to a definition
    for (const ref of definitionRefs) {
      const resolved = this.go_to_definition(def.file_path, ref.range.start);
      if (resolved) {
        // If resolved to an import, try to resolve the import to its actual definition
        let final_resolved = resolved;
        if (resolved.symbol_kind === 'import') {
          // Get all imports with their resolved definitions
          const imports = this.get_imports_with_definitions(def.file_path);
          const import_info = imports.find(imp => 
            imp.import_statement.name === resolved.name &&
            imp.import_statement.range.start.row === resolved.range.start.row &&
            imp.import_statement.range.start.column === resolved.range.start.column
          );
          
          if (import_info && import_info.imported_function) {
            final_resolved = import_info.imported_function;
          }
        }
        
        // Include all callable symbol kinds
        const callable_kinds = ['function', 'method', 'generator', 'class', 'constructor'];
        if (callable_kinds.includes(final_resolved.symbol_kind)) {
          // Check if this is a method call
          let is_method_call = ref.symbol_kind === 'method';
          
          // Additional check for method calls in different languages
          if (!is_method_call) {
            const file_cache = this.file_cache.get(def.file_path);
            if (file_cache) {
              const lines = file_cache.source_code.split('\n');
              const refLine = lines[ref.range.start.row];
              const beforeRef = refLine.substring(0, ref.range.start.column);
              
              // Check for method call patterns
              if (def.file_path.endsWith('.py') && beforeRef.endsWith('.')) {
                is_method_call = true;
              } else if ((def.file_path.endsWith('.ts') || def.file_path.endsWith('.js')) && 
                         (beforeRef.endsWith('.') || beforeRef.endsWith('?.'))) {
                is_method_call = true;
              } else if (def.file_path.endsWith('.rs') && 
                         (beforeRef.endsWith('.') || beforeRef.endsWith('::'))) {
                is_method_call = true;
              }
            }
          }
          
          calls.push({
            caller_def: def,
            called_def: final_resolved,
            call_location: ref.range.start,
            is_method_call
          });
        }
      }
    }
    
    return calls;
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
    const allFunctions: Def[] = [];
    const allCalls: FunctionCall[] = [];
    
    // Get all functions in the project
    const functionsByFile = this.get_all_functions();
    
    // Collect all functions and their calls
    for (const functions of functionsByFile.values()) {
      allFunctions.push(...functions);
      
      for (const func of functions) {
        const calls = this.get_function_calls(func);
        allCalls.push(...calls);
      }
    }
    
    return {
      functions: allFunctions,
      calls: allCalls
    };
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
    const nodes = new Map<string, CallGraphNode>();
    const edges: CallGraphEdge[] = [];
    const called_symbols = new Set<string>();
    
    // Default options
    const opts: CallGraphOptions = {
      include_external: options?.include_external ?? false,
      max_depth: options?.max_depth ?? undefined,
      file_filter: options?.file_filter ?? undefined
    };
    
    // Get all functions based on file filter
    const functions_by_file = this.get_all_functions();
    
    // First pass: Create nodes for all functions
    for (const [file_path, functions] of functions_by_file) {
      // Apply file filter if specified
      if (opts.file_filter && !opts.file_filter(file_path)) {
        continue;
      }
      
      for (const func of functions) {
        const symbol = func.symbol_id
        
        // Initialize node with empty calls and called_by arrays
        nodes.set(symbol, {
          symbol,
          definition: func,
          calls: [],
          called_by: []
        });
      }
    }
    
    // Second pass: Build edges and populate calls
    for (const [file_path, functions] of functions_by_file) {
      // Apply file filter if specified
      if (opts.file_filter && !opts.file_filter(file_path)) {
        continue;
      }
      
      for (const func of functions) {
        const caller_symbol = func.symbol_id;
        const caller_node = nodes.get(caller_symbol);
        
        if (!caller_node) continue;
        
        // Get all calls from this function
        const function_calls = this.get_calls_from_definition(func);
        
        for (const call of function_calls) {
          if (!call.called_def) continue;
          
          const callee_symbol = call.called_def.symbol_id;
          
          // Apply file filter if specified
          if (opts.file_filter && !opts.file_filter(call.called_def.file_path)) {
            continue;
          }
          
          // Skip external calls if not included
          if (!opts.include_external && !nodes.has(callee_symbol)) {
            continue;
          }
          
          // Create Call object
          const call_obj: Call = {
            symbol: callee_symbol,
            range: {
              start: call.call_location,
              end: call.call_location
            },
            kind: call.is_method_call ? 'method' : 'function',
            resolved_definition: call.called_def
          };
          
          // Add to caller's calls
          caller_node.calls.push(call_obj);
          
          // Create edge
          edges.push({
            from: caller_symbol,
            to: callee_symbol,
            location: {
              start: call.call_location,
              end: call.call_location
            }
          });
          
          // Track that this symbol is called
          called_symbols.add(callee_symbol);
          
          // Update callee's called_by if it's in our nodes
          const callee_node = nodes.get(callee_symbol);
          if (callee_node && !callee_node.called_by.includes(caller_symbol)) {
            callee_node.called_by.push(caller_symbol);
          }
        }
      }
    }
    
    // Apply max_depth if specified
    let final_nodes = nodes;
    if (opts.max_depth !== undefined) {
      final_nodes = this.apply_max_depth_filter(nodes, edges, opts.max_depth);
    }
    
    // Identify top-level nodes (not called by any other node in the graph)
    const top_level_nodes: string[] = [];
    for (const [symbol, node] of final_nodes) {
      if (!called_symbols.has(symbol)) {
        top_level_nodes.push(symbol);
      }
    }
    
    return {
      nodes: final_nodes,
      edges: edges.filter(edge => 
        final_nodes.has(edge.from) && final_nodes.has(edge.to)
      ),
      top_level_nodes
    };
  }

  /**
   * Apply max depth filtering to the call graph.
   * Returns a new set of nodes that are within max_depth from top-level nodes.
   */
  private apply_max_depth_filter(
    nodes: Map<string, CallGraphNode>,
    edges: CallGraphEdge[],
    max_depth: number
  ): Map<string, CallGraphNode> {
    const filtered_nodes = new Map<string, CallGraphNode>();
    const visited = new Set<string>();
    
    // Find top-level nodes
    const called_symbols = new Set(edges.map(e => e.to));
    const top_level_symbols = Array.from(nodes.keys()).filter(s => !called_symbols.has(s));
    
    // BFS from each top-level node
    const queue: Array<{ symbol: string; depth: number }> = 
      top_level_symbols.map(s => ({ symbol: s, depth: 0 }));
    
    while (queue.length > 0) {
      const { symbol, depth } = queue.shift()!;
      
      if (visited.has(symbol) || depth > max_depth) continue;
      visited.add(symbol);
      
      const node = nodes.get(symbol);
      if (!node) continue;
      
      filtered_nodes.set(symbol, node);
      
      // Add called functions to queue
      for (const call of node.calls) {
        if (!visited.has(call.symbol)) {
          queue.push({ symbol: call.symbol, depth: depth + 1 });
        }
      }
    }
    
    return filtered_nodes;
  }

  /**
   * Check if a position is within a range.
   */
  private is_position_within_range(pos: Point, range: { start: Point; end: Point }): boolean {
    // Check if position is after or at start
    if (pos.row < range.start.row) return false;
    if (pos.row === range.start.row && pos.column < range.start.column) return false;
    
    // Check if position is before or at end
    if (pos.row > range.end.row) return false;
    if (pos.row === range.end.row && pos.column > range.end.column) return false;
    
    return true;
  }

  /**
   * Get the source code for a definition.
   * 
   * @param def - The definition to extract source for
   * @param file_path - The path of the file containing the definition
   * @returns The exact source code for the definition
   */
  get_source_code(def: Def, file_path: string): string {
    const fileCache = this.file_cache.get(file_path);
    if (!fileCache) {
      return '';
    }
    
    // For functions/methods, we need to find the enclosing function/method node
    // since the definition only captures the identifier
    if (['function', 'method', 'generator'].includes(def.symbol_kind)) {
      const defNode = fileCache.tree.rootNode.descendantForPosition(
        { row: def.range.start.row, column: def.range.start.column },
        { row: def.range.end.row, column: def.range.end.column }
      );
      
      if (defNode) {
        // Walk up the tree to find the function/method declaration node
        let current = defNode.parent;
        while (current) {
          const nodeType = current.type;
          if (nodeType === 'function_declaration' ||
              nodeType === 'method_definition' ||
              nodeType === 'generator_function_declaration' ||
              nodeType === 'function_expression' ||
              nodeType === 'arrow_function' ||
              nodeType === 'function_definition' || // Python
              nodeType === 'decorated_definition' || // Python with decorators
              nodeType === 'function_item') { // Rust
            // Found the function node, extract its source
            const startPos = current.startPosition;
            const endPos = current.endPosition;
            
            const lines = fileCache.source_code.split('\n');
            if (startPos.row >= lines.length || endPos.row >= lines.length) {
              return '';
            }
            
            const extractedLines = lines.slice(startPos.row, endPos.row + 1);
            
            if (extractedLines.length > 0) {
              extractedLines[0] = extractedLines[0].substring(startPos.column);
              const lastIndex = extractedLines.length - 1;
              if (lastIndex === 0) {
                extractedLines[0] = extractedLines[0].substring(0, endPos.column - startPos.column);
              } else {
                extractedLines[lastIndex] = extractedLines[lastIndex].substring(0, endPos.column);
              }
            }
            
            return extractedLines.join('\n');
          }
          current = current.parent;
        }
      }
    }
    
    // For other types (variables, classes, etc.), use the definition range
    const lines = fileCache.source_code.split('\n');
    const startLine = def.range.start.row;
    const endLine = def.range.end.row;
    
    if (startLine >= lines.length || endLine >= lines.length) {
      return '';
    }
    
    const extractedLines = lines.slice(startLine, endLine + 1);
    
    if (extractedLines.length > 0) {
      extractedLines[0] = extractedLines[0].substring(def.range.start.column);
      const lastIndex = extractedLines.length - 1;
      if (lastIndex === 0) {
        extractedLines[0] = extractedLines[0].substring(0, def.range.end.column - def.range.start.column);
      } else {
        extractedLines[lastIndex] = extractedLines[lastIndex].substring(0, def.range.end.column);
      }
    }
    
    return extractedLines.join('\n');
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
    const fileCache = this.file_cache.get(file_path);
    if (!fileCache) {
      return { source: '' };
    }
    
    const lines = fileCache.source_code.split('\n');
    const startLine = def.range.start.row;
    const endLine = def.range.end.row;
    
    // Get the basic source
    const source = this.get_source_code(def, file_path);
    
    // Get language-specific context extraction
    const config = this.get_language_config(file_path);
    let docstring: string | undefined;
    let decorators: string[] | undefined;
    
    if (config && config.extract_context && ['function', 'method', 'generator'].includes(def.symbol_kind)) {
      // Find the AST node for this definition
      const defNode = fileCache.tree.rootNode.descendantForPosition(
        { row: def.range.start.row, column: def.range.start.column },
        { row: def.range.end.row, column: def.range.end.column }
      );
      
      if (defNode) {
        // Find the function/method declaration node
        let current = defNode.parent;
        while (current) {
          const nodeType = current.type;
          if (nodeType === 'function_declaration' ||
              nodeType === 'method_definition' ||
              nodeType === 'generator_function_declaration' ||
              nodeType === 'function_expression' ||
              nodeType === 'arrow_function' ||
              nodeType === 'function_definition' || // Python
              nodeType === 'decorated_definition' || // Python with decorators
              nodeType === 'function_item') { // Rust
            // Extract context using language-specific extractor
            const context = config.extract_context(current, lines, current.startPosition.row);
            docstring = context.docstring;
            decorators = context.decorators;
            break;
          }
          current = current.parent;
        }
      }
    }
    
    // Add context lines if requested
    let contextSource = source;
    if (context_lines > 0) {
      // Find the actual start/end lines of the source we extracted
      let actualStartLine = startLine;
      let actualEndLine = endLine;
      
      // For functions, we need to find the actual boundaries
      if (['function', 'method', 'generator'].includes(def.symbol_kind) && fileCache) {
        const defNode = fileCache.tree.rootNode.descendantForPosition(
          { row: def.range.start.row, column: def.range.start.column },
          { row: def.range.end.row, column: def.range.end.column }
        );
        
        if (defNode) {
          let current = defNode.parent;
          while (current) {
            const nodeType = current.type;
            if (nodeType === 'function_declaration' ||
                nodeType === 'method_definition' ||
                nodeType === 'generator_function_declaration' ||
                nodeType === 'function_expression' ||
                nodeType === 'arrow_function' ||
                nodeType === 'function_definition' ||
                nodeType === 'decorated_definition' ||
                nodeType === 'function_item') { // Rust
              actualStartLine = current.startPosition.row;
              actualEndLine = current.endPosition.row;
              break;
            }
            current = current.parent;
          }
        }
      }
      
      const contextStartLine = Math.max(0, actualStartLine - context_lines);
      const contextEndLine = Math.min(lines.length - 1, actualEndLine + context_lines);
      
      const beforeLines = lines.slice(contextStartLine, actualStartLine);
      const afterLines = lines.slice(actualEndLine + 1, contextEndLine + 1);
      
      if (beforeLines.length > 0 || afterLines.length > 0) {
        contextSource = [
          ...beforeLines,
          ...source.split('\n'),
          ...afterLines
        ].join('\n');
      }
    }
    
    return {
      source: contextSource,
      docstring,
      decorators: decorators && decorators.length > 0 ? decorators : undefined
    };
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