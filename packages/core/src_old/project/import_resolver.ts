/**
 * ImportResolver Service
 * 
 * Dedicated service for all import resolution logic.
 * This service is the single source of truth for resolving imports to their definitions.
 * 
 * Responsibilities:
 * - Resolving import statements to their actual definitions
 * - Module path resolution across different languages
 * - Managing import-to-definition mappings
 * 
 * This service eliminates circular dependencies by being a leaf service
 * that only depends on core types and utilities.
 */

import { Def, Import, ImportInfo } from '../graph';
import { ProjectState } from '../storage/storage_interface';
import { ModuleResolver } from '../module_resolver';
import * as path from 'path';

/**
 * Interface for ImportResolver service
 */
export interface IImportResolver {
  /**
   * Resolve a single import to its definition
   * @param importDef The import definition to resolve
   * @param filePath The file containing the import
   * @param state The project state containing all graphs
   * @returns The resolved definition or undefined if not found
   */
  resolveImport(
    importDef: Import | Def,
    filePath: string,
    state: ProjectState
  ): Def | undefined;

  /**
   * Get all imports in a file with their resolved definitions
   * @param state The project state
   * @param filePath The file to get imports for
   * @returns Array of import information with resolved definitions
   */
  getImportsWithDefinitions(
    state: ProjectState,
    filePath: string
  ): ImportInfo[];

  /**
   * Resolve a module path to an actual file path
   * @param fromFile The file containing the import
   * @param importPath The import path to resolve
   * @param state Optional project state for virtual file resolution
   * @returns The resolved file path or null if not found
   */
  resolveModulePath(
    fromFile: string,
    importPath: string,
    state?: ProjectState
  ): string | null;
}

/**
 * Implementation of ImportResolver service
 */
export class ImportResolver implements IImportResolver {
  /**
   * Resolve a single import to its definition
   */
  resolveImport(
    importDef: Import | Def,
    filePath: string,
    state: ProjectState
  ): Def | undefined {
    // If it's not an import, return as-is
    if ('symbol_kind' in importDef && importDef.symbol_kind !== 'import') {
      return importDef as Def;
    }

    const imports = this.getImportsWithDefinitions(state, filePath);
    const importInfo = imports.find(imp => {
      // First try exact position match if ranges are available
      if (importDef.range && imp.import_statement.range &&
          imp.import_statement.name === importDef.name &&
          imp.import_statement.range.start.row === importDef.range.start.row &&
          imp.import_statement.range.start.column === importDef.range.start.column) {
        return true;
      }
      // Fallback to name-only match (for cases where position differs or ranges missing)
      return imp.import_statement.name === importDef.name;
    });

    return importInfo?.imported_function;
  }

  /**
   * Get all imports in a file with their resolved definitions
   * This is the core logic extracted from QueryService
   */
  getImportsWithDefinitions(
    state: ProjectState,
    filePath: string
  ): ImportInfo[] {
    const graph = state.file_graphs.get(filePath);
    if (!graph) return [];
    
    const imports = graph.getAllImports();
    const importInfos: ImportInfo[] = [];
    
    for (const imp of imports) {
      // Check if this is a namespace import (import * as name)
      const isNamespaceImport = imp.source_name === '*';
      
      // For namespace imports, we need to handle them specially
      if (isNamespaceImport) {
        // Try to resolve the import path if source_module is available
        if (imp.source_module) {
          const targetFile = this.resolveModulePath(filePath, imp.source_module, state);
          
          if (targetFile) {
            let targetGraph = state.file_graphs.get(targetFile);
            
            // If not found with absolute path, try to find a matching relative path
            if (!targetGraph && path.isAbsolute(targetFile)) {
              // Try to find a file in the project that ends with the same relative path
              for (const [projectFile, graph] of state.file_graphs) {
                if (targetFile.endsWith(projectFile) || targetFile.endsWith(projectFile.replace(/\\/g, '/'))) {
                  targetGraph = graph;
                  break;
                }
              }
            }
            
            if (targetGraph) {
              // For namespace imports, create a synthetic definition that represents the module
              // This allows namespace.member resolution to work
              const moduleDef: Def = {
                id: -1,
                kind: 'definition',
                name: imp.name, // The local name of the namespace
                symbol_kind: 'module',
                file_path: targetFile,
                symbol_id: `${targetFile}#module`,
                range: imp.range,
                is_exported: true
              };
              
              importInfos.push({
                imported_function: moduleDef,
                import_statement: imp,
                local_name: imp.name
              });
              continue;
            }
          }
        }
      }
      
      // Use source_name if available (for renamed imports), otherwise use the import name
      const export_name = imp.source_name || imp.name;
      
      // Try to resolve the import path if source_module is available
      let targetFile: string | null = null;
      
      if (imp.source_module) {
        targetFile = this.resolveModulePath(filePath, imp.source_module, state);
        
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
                exportedDef = defs.find(def => def.name === export_name) || null;
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
              exportedDef = defs.find(def => def.name === export_name) || null;
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
   * Resolve a module path to an actual file path
   * This consolidates module resolution logic for all languages
   */
  resolveModulePath(
    fromFile: string,
    importPath: string,
    state?: ProjectState
  ): string | null {
    // Determine file extension to handle language-specific imports
    const ext = path.extname(fromFile).toLowerCase();
    
    // For Python and Rust, allow non-relative imports (e.g., 'lib' in Python/Rust)
    // For JS/TS, skip external modules (node_modules) unless they start with . or /
    if (ext !== '.py' && ext !== '.rs') {
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        return null;
      }
    }
    
    // Try virtual file system resolution first (for tests and in-memory files)
    if (state) {
      const resolved = this.resolveModulePathVirtual(fromFile, importPath, state);
      if (resolved) {
        return resolved;
      }
    }
    
    // Fall back to filesystem resolution based on language
    if (ext === '.py') {
      return ModuleResolver.resolvePythonImport(fromFile, importPath);
    } else if (ext === '.rs') {
      return ModuleResolver.resolveRustModule(fromFile, importPath);
    } else if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      // For TypeScript/JavaScript, use the generic module resolver
      return ModuleResolver.resolveModulePath(fromFile, importPath);
    } else {
      // Default to generic module resolver
      return ModuleResolver.resolveModulePath(fromFile, importPath);
    }
  }
  
  /**
   * Resolve module path using virtual file system (project state)
   */
  private resolveModulePathVirtual(
    fromFile: string,
    importPath: string,
    state: ProjectState
  ): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromFile);
      const basePath = path.join(dir, importPath).replace(/\\/g, '/');
      
      // Common extensions to try
      const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.rs', ''];
      
      for (const ext of extensions) {
        const testPath = basePath + ext;
        // Normalize the path for comparison
        const normalizedPath = testPath.replace(/^\.\//, '');
        
        // Check if this file exists in the project
        if (state.file_graphs.has(normalizedPath)) {
          return normalizedPath;
        }
        
        // Also try without leading directory separators
        const withoutLeading = testPath.replace(/^[./\\]+/, '');
        if (state.file_graphs.has(withoutLeading)) {
          return withoutLeading;
        }
      }
      
      // Try index files
      const indexFiles = ['index.js', 'index.ts', '__init__.py', 'mod.rs'];
      for (const indexFile of indexFiles) {
        const indexPath = path.join(basePath, indexFile).replace(/\\/g, '/');
        const normalizedIndex = indexPath.replace(/^\.\//, '');
        if (state.file_graphs.has(normalizedIndex)) {
          return normalizedIndex;
        }
      }
    }
    
    return null;
  }

  /**
   * Resolve Rust module fallback for virtual file system
   * This is used when the standard resolution fails in test environments
   */
  resolveRustModuleFallback(
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