import { ScopeGraph } from '../graph';
import { Tree } from 'tree-sitter';
import { LanguageConfig } from '../types';
import { build_scope_graph } from '../scope_resolution';
import { Edit } from '../edit';
import * as path from 'path';
import { StoredFileCache, ProjectState } from '../storage/storage_interface';
import { updateFileInState, removeFileFromState } from '../storage/storage_utils';
import { 
  detect_file_exports,
  detect_file_imports
} from '../call_graph/import_export_detector';
import {
  set_imported_class
} from '../call_graph/type_tracker';
import {
  get_or_create_file_type_tracker,
  update_file_type_tracker
} from '../call_graph/project_graph_data';
import { ImportInfo } from '../graph';

/**
 * FileManager handles all file-related operations for the Project class
 * It encapsulates file parsing, caching, and language detection
 */
export class FileManager {
  private readonly languages: ReadonlyMap<string, LanguageConfig>;
  
  constructor(languages: ReadonlyMap<string, LanguageConfig>) {
    this.languages = languages;
  }
  
  /**
   * Get language configuration for a file
   */
  getLanguageConfig(filePath: string): LanguageConfig | null {
    const ext = path.extname(filePath).slice(1); // Remove the dot
    return this.languages.get(ext) || null;
  }
  
  /**
   * Parse a file and return the syntax tree
   */
  parseFile(
    filePath: string,
    sourceCode: string,
    oldTree?: Tree,
    edit?: Edit
  ): Tree | null {
    const config = this.getLanguageConfig(filePath);
    if (!config) {
      console.warn(`No language configuration found for file: ${filePath}`);
      return null;
    }
    
    let tree: Tree;
    
    if (oldTree && edit) {
      // Incremental parsing
      // Convert from our Edit interface to tree-sitter's expected format
      const treeEdit = {
        startIndex: edit.startIndex || edit.start_byte,
        oldEndIndex: edit.oldEndIndex || edit.old_end_byte,
        newEndIndex: edit.newEndIndex || edit.new_end_byte,
        startPosition: edit.startPosition || edit.start_position,
        oldEndPosition: edit.oldEndPosition || edit.old_end_position,
        newEndPosition: edit.newEndPosition || edit.new_end_position,
      };
      oldTree.edit(treeEdit);
      
      try {
        tree = config.parser.parse(sourceCode, oldTree);
      } catch (error: any) {
        // Handle tree-sitter limitations
        if (error.message === 'Invalid argument') {
          console.warn(`File ${filePath} cannot be parsed by tree-sitter (${(sourceCode.length / 1024).toFixed(1)}KB). Error: ${error.message}. Skipping.`);
          return null;
        }
        throw error;
      }
    } else {
      // Full parsing
      // Set a longer timeout for CI environments
      const oldTimeout = config.parser.getTimeoutMicros();
      config.parser.setTimeoutMicros(10000000); // 10 seconds
      
      try {
        tree = config.parser.parse(sourceCode);
      } catch (error: any) {
        // Handle tree-sitter limitations
        if (error.message === 'Invalid argument') {
          console.warn(`File ${filePath} cannot be parsed by tree-sitter (${(sourceCode.length / 1024).toFixed(1)}KB). Error: ${error.message}. Skipping.`);
          return null;
        }
        throw error;
      } finally {
        // Restore original timeout
        config.parser.setTimeoutMicros(oldTimeout);
      }
    }
    
    // Handle edge case where parse returns a tree without rootNode
    if (!tree) {
      console.error(`Parser returned null tree for ${filePath} with ${config.name} parser`);
      return null;
    }
    
    if (!tree.rootNode) {
      // This typically means parsing timed out
      console.error(`Parse timeout for ${filePath} with ${config.name} parser`);
      console.error(`Source code length: ${sourceCode.length}`);
      console.error(`Try increasing parser timeout or check if language files are properly loaded`);
      
      // Try to parse a simple test to see if the parser works at all
      const testCode = config.name === 'python' ? 'x = 1' : 'var x = 1';
      const testTree = config.parser.parse(testCode);
      console.error(`Test parse result: ${testTree ? 'tree exists' : 'no tree'}, rootNode: ${testTree?.rootNode ? 'exists' : 'missing'}`);
      
      return null;
    }
    
    return tree;
  }
  
  /**
   * Process a file and update the project state
   */
  processFile(
    state: ProjectState,
    filePath: string,
    sourceCode: string,
    edit?: Edit,
    getImportsWithDefinitions?: (filePath: string) => ImportInfo[]
  ): ProjectState | null {
    // Get cached tree if incremental parsing
    const cachedFile = state.file_cache.get(filePath);
    const oldTree = cachedFile?.tree;
    
    // Parse the file
    const tree = this.parseFile(filePath, sourceCode, oldTree, edit);
    if (!tree) {
      return null; // Parsing failed
    }
    
    // Get language config
    const config = this.getLanguageConfig(filePath);
    if (!config) {
      return null;
    }
    
    // Build scope graph
    const graph = build_scope_graph(tree, config, filePath, sourceCode);
    
    // Create file cache
    const fileCache: StoredFileCache = {
      tree,
      source_code: sourceCode,
      graph
    };
    
    // Update state with new file data
    let newState = updateFileInState(state, filePath, fileCache, graph);
    
    // Process file exports
    newState = this.processFileExports(newState, filePath, graph, fileCache);
    
    // Process file imports if callback provided
    if (getImportsWithDefinitions) {
      const imports = getImportsWithDefinitions(filePath);
      if (imports.length > 0) {
        newState = this.processFileImports(newState, filePath, imports);
      }
    }
    
    return newState;
  }
  
  /**
   * Process file exports
   */
  private processFileExports(
    state: ProjectState,
    filePath: string,
    graph: ScopeGraph,
    fileCache: StoredFileCache
  ): ProjectState {
    let tracker = get_or_create_file_type_tracker(state.call_graph_data, filePath);
    const exports = detect_file_exports(filePath, graph, fileCache);
    
    // Update the tracker with exports
    for (const exp of exports) {
      if (exp.definition) {
        // Mark as exported in tracker
        tracker = {
          ...tracker,
          exportedDefinitions: new Set([...tracker.exportedDefinitions, exp.exportName])
        };
      }
    }
    
    // Update call graph data with new tracker
    const newCallGraphData = update_file_type_tracker(state.call_graph_data, filePath, tracker);
    
    return {
      ...state,
      call_graph_data: newCallGraphData
    };
  }
  
  /**
   * Process file imports
   */
  private processFileImports(
    state: ProjectState,
    filePath: string,
    imports: ImportInfo[]
  ): ProjectState {
    let tracker = get_or_create_file_type_tracker(state.call_graph_data, filePath);
    
    for (const imp of imports) {
      if (imp.imported_function.symbol_kind === 'class') {
        // Track imported classes
        tracker = set_imported_class(tracker, imp.local_name, {
          className: imp.imported_function.name,
          classDef: imp.imported_function,
          sourceFile: imp.imported_function.file_path
        });
      }
    }
    
    // Update call graph data with new tracker
    const newCallGraphData = update_file_type_tracker(state.call_graph_data, filePath, tracker);
    
    return {
      ...state,
      call_graph_data: newCallGraphData
    };
  }
  
  /**
   * Remove a file from the project state
   */
  removeFile(state: ProjectState, filePath: string): ProjectState {
    return removeFileFromState(state, filePath);
  }
  
  /**
   * Calculate byte offset from position
   */
  calculateByteOffset(sourceCode: string, position: { row: number; column: number }): number {
    let byteOffset = 0;
    let currentRow = 0;
    let currentCol = 0;
    
    for (let i = 0; i <= sourceCode.length; i++) {
      if (currentRow === position.row && currentCol === position.column) {
        byteOffset = i;
        break;
      }
      
      if (i < sourceCode.length && sourceCode[i] === '\n') {
        currentRow++;
        currentCol = 0;
      } else {
        currentCol++;
      }
    }
    
    return byteOffset;
  }
  
  /**
   * Calculate end position given start position and text
   */
  calculateEndPosition(start: { row: number; column: number }, text: string): { row: number; column: number } {
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
}