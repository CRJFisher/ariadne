import { ProjectState } from '../storage/storage_interface';
import { ProjectSource } from '../project_source';
import { Def, ImportInfo, Import } from '../graph';
import { ModuleResolver } from '../module_resolver';
import * as path from 'path';

/**
 * QueryService handles complex queries across the project
 */
export class QueryService {
  private readonly projectSource: ProjectSource;
  
  constructor() {
    // We'll need to refactor ProjectSource to work with ProjectState
    // For now, create a temporary instance
    this.projectSource = new ProjectSource(new Map(), new Map());
  }
  
  /**
   * Get the source code for a definition
   */
  getSourceCode(
    state: ProjectState,
    def: Def,
    filePath: string
  ): string {
    const cache = state.file_cache.get(filePath);
    if (!cache) return '';
    
    // Calculate byte positions from line/column positions
    const sourceLines = cache.source_code.split('\n');
    let startByte = 0;
    let endByte = 0;
    
    // Calculate start byte
    for (let i = 0; i < def.range.start.row; i++) {
      startByte += sourceLines[i].length + 1; // +1 for newline
    }
    startByte += def.range.start.column;
    
    // Calculate end byte
    endByte = startByte;
    for (let i = def.range.start.row; i <= def.range.end.row; i++) {
      if (i === def.range.end.row) {
        endByte += def.range.end.column - (i === def.range.start.row ? def.range.start.column : 0);
      } else {
        endByte += sourceLines[i].length - (i === def.range.start.row ? def.range.start.column : 0) + 1;
      }
    }
    
    return cache.source_code.substring(startByte, endByte);
  }
  
  /**
   * Get the source code with context for a definition
   */
  getSourceWithContext(
    state: ProjectState,
    def: Def,
    filePath: string,
    contextLines: number = 0
  ): {
    source: string;
    docstring?: string;
    decorators?: string[];
  } {
    const cache = state.file_cache.get(filePath);
    if (!cache) {
      return { source: '' };
    }
    
    const sourceLines = cache.source_code.split('\n');
    const startLine = Math.max(0, def.range.start.row - contextLines);
    const endLine = Math.min(sourceLines.length - 1, def.range.end.row + contextLines);
    
    const contextSource = sourceLines.slice(startLine, endLine + 1).join('\n');
    
    // TODO: Extract docstring and decorators based on language
    return {
      source: contextSource
    };
  }
  
  /**
   * Get all imports in a file with their resolved definitions
   */
  getImportsWithDefinitions(
    state: ProjectState,
    filePath: string,
    goToDefinition: (filePath: string, position: { row: number; column: number }) => Def | undefined
  ): ImportInfo[] {
    const graph = state.file_graphs.get(filePath);
    if (!graph) return [];
    
    const imports = graph.getAllImports();
    const importInfos: ImportInfo[] = [];
    
    for (const imp of imports) {
      // Use source_name if available (for renamed imports), otherwise use the import name
      const export_name = imp.source_name || imp.name;
      
      // Try to resolve the import path if source_module is available
      let targetFile: string | null = null;
      
      if (imp.source_module) {
        // Detect language and use appropriate resolver
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.py') {
          targetFile = ModuleResolver.resolvePythonImport(filePath, imp.source_module);
        } else if (ext === '.rs') {
          targetFile = ModuleResolver.resolveRustModule(filePath, imp.source_module);
          // Fallback for virtual file system (tests)
          if (!targetFile && imp.source_module) {
            targetFile = this.resolveRustModuleFallback(state, imp.source_module);
          }
        } else if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
          // For TypeScript/JavaScript, use the generic module resolver
          targetFile = ModuleResolver.resolveModulePath(filePath, imp.source_module);
        } else {
          targetFile = ModuleResolver.resolveModulePath(filePath, imp.source_module);
        }
        
        // If we resolved a specific file, only search that file
        if (targetFile) {
          let targetGraph = state.file_graphs.get(targetFile);
          
          // If not found with absolute path, try to find a matching relative path
          if (!targetGraph && path.isAbsolute(targetFile)) {
            // Try to find a file in the project that ends with the same relative path
            for (const [projectFile, graph] of state.file_graphs) {
              if (targetFile.endsWith(projectFile) || targetFile.endsWith(projectFile.replace(/\\/g, '/'))) {
                targetGraph = graph;
                targetFile = projectFile;
                break;
              }
            }
          }
          
          if (targetGraph) {
            let exportedDef = targetGraph.findExportedDef(export_name);
            
            // If not found by is_exported flag, check the export tracker
            if (!exportedDef) {
              const tracker = state.call_graph_data.fileTypeTrackers.get(targetFile);
              if (tracker && tracker.exportedDefinitions.has(export_name)) {
                const defs = targetGraph.getNodes<Def>('definition');
                exportedDef = defs.find(def => def.name === export_name);
              }
            }
            
            if (exportedDef) {
              importInfos.push({
                imported_function: exportedDef,
                import_statement: imp,
                local_name: imp.name
              });
              continue;
            }
          }
        }
      }
      
      // Fallback to searching all files if module resolution failed
      if (!targetFile) {
        for (const [otherFile, otherGraph] of state.file_graphs) {
          if (otherFile === filePath) continue;
          
          let exportedDef = otherGraph.findExportedDef(export_name);
          
          // If not found by is_exported flag, check the export tracker
          if (!exportedDef) {
            const tracker = state.call_graph_data.fileTypeTrackers.get(otherFile);
            if (tracker && tracker.exportedDefinitions.has(export_name)) {
              const defs = otherGraph.getNodes<Def>('definition');
              exportedDef = defs.find(def => def.name === export_name);
            }
          }
          
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
    }
    
    return importInfos;
  }
  
  /**
   * Resolve Rust module fallback for virtual file system
   */
  private resolveRustModuleFallback(
    state: ProjectState,
    sourceModule: string
  ): string | null {
    // Try to find a file that matches the module path
    const parts = sourceModule.split('::');
    
    if (parts[0] === 'crate') {
      // For crate:: imports, try to resolve relative to src/
      parts.shift(); // Remove 'crate'
      const possiblePaths = [
        `src/${parts.join('/')}.rs`,
        `src/${parts.join('/')}/mod.rs`,
        `${parts.join('/')}.rs`,
        `${parts.join('/')}/mod.rs`
      ];
      
      for (const possiblePath of possiblePaths) {
        if (state.file_graphs.has(possiblePath)) {
          return possiblePath;
        }
      }
    } else {
      // Original fallback for non-crate imports
      const moduleName = parts[parts.length - 1];
      const possibleFile = moduleName + '.rs';
      
      if (state.file_graphs.has(possibleFile)) {
        return possibleFile;
      }
    }
    
    return null;
  }
}