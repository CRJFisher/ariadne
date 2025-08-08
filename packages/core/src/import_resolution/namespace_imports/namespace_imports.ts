/**
 * Universal Namespace Import Resolution Interface
 * 
 * This module provides the contract for resolving namespace imports across all languages.
 * Namespace imports allow importing all exports from a module under a single identifier.
 * 
 * Examples:
 * - JavaScript/TypeScript: import * as math from './math'
 * - Python: import math or import math as m
 * - Rust: use module::* or use module
 */

import type { Def, Import, Ref, ScopeGraph } from '../../scope_resolution';

/**
 * Result of resolving all exports from a namespace
 */
export type NamespaceExport = 
  | Def 
  | { isNamespaceReExport: true; targetModule: string };

/**
 * Configuration for namespace resolution
 */
export interface NamespaceResolutionConfig {
  /** Get the scope graph for a file */
  get_file_graph?: (filePath: string) => ScopeGraph | undefined;
  
  /** Get imports with their resolved definitions */
  get_imports_with_definitions: (filePath: string) => Array<{
    local_name: string;
    import_statement: Import;
    imported_function: Def;
  }>;
  
  /** Debug mode flag */
  debug?: boolean;
}

/**
 * Universal namespace import resolver interface
 * Each language must implement this interface
 */
export interface NamespaceImportResolver {
  /**
   * Check if an import is a namespace import
   * @param imp The import to check
   * @returns true if this is a namespace import
   */
  isNamespaceImport(imp: Import): boolean;
  
  /**
   * Resolve all exports from a namespace import target
   * @param targetFile The file to get exports from
   * @param config Resolution configuration
   * @returns Map of export names to their definitions
   */
  resolveNamespaceExports(
    targetFile: string,
    config: NamespaceResolutionConfig
  ): Map<string, NamespaceExport>;
  
  /**
   * Resolve a member access on a namespace import
   * @param namespaceName The namespace identifier (e.g., 'math')
   * @param memberRef The member being accessed (e.g., 'multiply')
   * @param contextDef The definition context where the reference occurs
   * @param config Resolution configuration
   * @returns The resolved definition or undefined
   */
  resolveNamespaceMember(
    namespaceName: string,
    memberRef: Ref,
    contextDef: Def,
    config: NamespaceResolutionConfig
  ): Def | undefined;
  
  /**
   * Resolve nested namespace member access
   * @param namespacePath Array of namespace segments (e.g., ['math', 'operations'])
   * @param memberRef The final member being accessed
   * @param contextDef The definition context
   * @param config Resolution configuration
   * @returns The resolved definition or undefined
   */
  resolveNestedNamespaceMember(
    namespacePath: string[],
    memberRef: Ref,
    contextDef: Def,
    config: NamespaceResolutionConfig
  ): Def | undefined;
}

/**
 * Base implementation of namespace resolution
 * Languages can extend or override this implementation
 */
export abstract class BaseNamespaceResolver implements NamespaceImportResolver {
  /**
   * Default implementation checks for source_name === '*'
   * Languages can override for different patterns
   */
  isNamespaceImport(imp: Import): boolean {
    return imp.source_name === '*';
  }
  
  /**
   * Get all exports from a target file
   */
  resolveNamespaceExports(
    targetFile: string,
    config: NamespaceResolutionConfig
  ): Map<string, NamespaceExport> {
    const exports = new Map<string, NamespaceExport>();
    const targetGraph = config.get_file_graph?.(targetFile);
    
    if (!targetGraph) {
      return exports;
    }
    
    // Collect all exported definitions
    const defs = targetGraph.getNodes('definition') as Def[];
    for (const def of defs) {
      if (def.is_exported === true) {
        exports.set(def.name, def);
      }
    }
    
    // Check for re-exported namespaces
    this.findReExportedNamespaces(targetGraph, exports);
    
    return exports;
  }
  
  /**
   * Find re-exported namespaces in the target file
   */
  protected findReExportedNamespaces(
    targetGraph: ScopeGraph,
    exports: Map<string, NamespaceExport>
  ): void {
    const imports = targetGraph.getAllImports();
    const refs = targetGraph.getNodes('reference') as Ref[];
    
    for (const imp of imports) {
      if (this.isNamespaceImport(imp)) {
        // Check if this namespace is re-exported
        const exportRef = refs.find(ref => 
          ref.name === imp.name &&
          this.isInExportContext(ref, targetGraph)
        );
        
        if (exportRef && imp.source_module) {
          exports.set(imp.name, {
            isNamespaceReExport: true,
            targetModule: imp.source_module
          });
        }
      }
    }
  }
  
  /**
   * Check if a reference is in an export context
   * Languages should override this with proper detection
   */
  protected abstract isInExportContext(ref: Ref, graph: ScopeGraph): boolean;
  
  /**
   * Resolve a member access on a namespace
   */
  resolveNamespaceMember(
    namespaceName: string,
    memberRef: Ref,
    contextDef: Def,
    config: NamespaceResolutionConfig
  ): Def | undefined {
    const imports = config.get_imports_with_definitions(contextDef.file_path);
    
    // Find the namespace import
    const namespaceImport = imports.find(imp => 
      imp.local_name === namespaceName && 
      this.isNamespaceImport(imp.import_statement)
    );
    
    if (!namespaceImport) {
      return undefined;
    }
    
    // Get all exports from the target
    const targetFile = namespaceImport.imported_function.file_path;
    const allExports = this.resolveNamespaceExports(targetFile, config);
    
    // Direct member access
    const directMember = allExports.get(memberRef.name);
    if (directMember && 'symbol_kind' in directMember) {
      return directMember;
    }
    
    // Check for nested namespace access
    return this.resolveNestedExport(
      targetFile,
      memberRef.name,
      allExports,
      config
    );
  }
  
  /**
   * Resolve a member through nested namespace exports
   */
  protected resolveNestedExport(
    targetFile: string,
    memberName: string,
    exports: Map<string, NamespaceExport>,
    config: NamespaceResolutionConfig
  ): Def | undefined {
    for (const [exportName, exportDef] of exports) {
      if ('isNamespaceReExport' in exportDef && exportDef.isNamespaceReExport) {
        // Re-exported namespace - resolve through it
        const imports = config.get_imports_with_definitions(targetFile);
        const nestedImport = imports.find(imp => 
          imp.local_name === exportName && 
          this.isNamespaceImport(imp.import_statement)
        );
        
        if (nestedImport) {
          const nestedExports = this.resolveNamespaceExports(
            nestedImport.imported_function.file_path,
            config
          );
          const nestedMember = nestedExports.get(memberName);
          if (nestedMember && 'symbol_kind' in nestedMember) {
            return nestedMember;
          }
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Resolve nested namespace member access
   */
  resolveNestedNamespaceMember(
    namespacePath: string[],
    memberRef: Ref,
    contextDef: Def,
    config: NamespaceResolutionConfig
  ): Def | undefined {
    if (namespacePath.length < 1) {
      return undefined;
    }
    
    // Start with the base namespace
    const baseNamespace = namespacePath[0];
    const imports = config.get_imports_with_definitions(contextDef.file_path);
    
    const namespaceImport = imports.find(imp => 
      imp.local_name === baseNamespace && 
      this.isNamespaceImport(imp.import_statement)
    );
    
    if (!namespaceImport) {
      return undefined;
    }
    
    // Navigate through the namespace chain
    let currentFile = namespaceImport.imported_function.file_path;
    
    for (let i = 1; i < namespacePath.length; i++) {
      const segment = namespacePath[i];
      const exports = this.resolveNamespaceExports(currentFile, config);
      const segmentExport = exports.get(segment);
      
      if (!segmentExport) {
        return undefined;
      }
      
      if ('isNamespaceReExport' in segmentExport) {
        // Follow the re-export
        const segmentImports = config.get_imports_with_definitions(currentFile);
        const segmentImport = segmentImports.find(imp => 
          imp.local_name === segment && 
          this.isNamespaceImport(imp.import_statement)
        );
        
        if (segmentImport) {
          currentFile = segmentImport.imported_function.file_path;
        } else {
          return undefined;
        }
      } else if ('file_path' in segmentExport) {
        currentFile = segmentExport.file_path;
      } else {
        return undefined;
      }
    }
    
    // Finally resolve the member
    const finalExports = this.resolveNamespaceExports(currentFile, config);
    const member = finalExports.get(memberRef.name);
    
    return member && 'symbol_kind' in member ? member : undefined;
  }
}

/**
 * Factory for creating language-specific namespace resolvers
 */
export interface NamespaceResolverFactory {
  createResolver(language: string): NamespaceImportResolver;
}

/**
 * Registry for namespace resolvers by language
 */
export class NamespaceResolverRegistry {
  private static resolvers = new Map<string, NamespaceImportResolver>();
  
  static register(language: string, resolver: NamespaceImportResolver): void {
    this.resolvers.set(language, resolver);
  }
  
  static get(language: string): NamespaceImportResolver | undefined {
    return this.resolvers.get(language);
  }
  
  static getOrThrow(language: string): NamespaceImportResolver {
    const resolver = this.resolvers.get(language);
    if (!resolver) {
      throw new Error(`No namespace resolver registered for language: ${language}`);
    }
    return resolver;
  }
}