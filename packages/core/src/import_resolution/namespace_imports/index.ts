/**
 * Namespace Imports Module
 * 
 * Central export point for namespace import resolution functionality.
 * This module provides a unified interface for resolving namespace imports
 * across all supported languages.
 */

export {
  // Core types and interfaces
  type NamespaceExport,
  type NamespaceResolutionConfig,
  type NamespaceImportResolver,
  type NamespaceResolverFactory,
  
  // Base implementation
  BaseNamespaceResolver,
  
  // Registry
  NamespaceResolverRegistry
} from './namespace_imports';

export {
  // JavaScript/TypeScript implementations
  JavaScriptNamespaceResolver,
  TypeScriptNamespaceResolver,
  registerJavaScriptResolvers
} from './namespace_imports.javascript';

// Re-export test factory for testing
export {
  type LanguageAdapter,
  createNamespaceImportTestSuite,
  REQUIRED_TEST_NAMES,
  validateTestCoverage
} from './namespace_imports_test_factory';

import type { Def, Import, Ref } from '../../scope_resolution';
import { NamespaceResolverRegistry, type NamespaceResolutionConfig } from './namespace_imports';

/**
 * Main API for namespace import resolution
 * This is what the rest of the codebase should use
 */
export class NamespaceImportAPI {
  /**
   * Resolve a namespace member reference
   * Automatically detects the language and uses the appropriate resolver
   */
  static resolveNamespaceMember(
    namespaceName: string,
    memberRef: Ref,
    contextDef: Def,
    config: NamespaceResolutionConfig,
    language?: string
  ): Def | undefined {
    // Detect language from file extension if not provided
    const lang = language || this.detectLanguage(contextDef.file_path);
    const resolver = NamespaceResolverRegistry.get(lang);
    
    if (!resolver) {
      // Fallback to a basic resolver if language not registered
      console.warn(`No namespace resolver for language: ${lang}`);
      return undefined;
    }
    
    return resolver.resolveNamespaceMember(
      namespaceName,
      memberRef,
      contextDef,
      config
    );
  }
  
  /**
   * Check if an import is a namespace import
   */
  static isNamespaceImport(imp: Import, language?: string): boolean {
    const lang = language || this.detectLanguage(imp.file_path);
    const resolver = NamespaceResolverRegistry.get(lang);
    
    if (!resolver) {
      // Default check
      return imp.source_name === '*';
    }
    
    return resolver.isNamespaceImport(imp);
  }
  
  /**
   * Resolve all exports from a namespace
   */
  static resolveNamespaceExports(
    targetFile: string,
    config: NamespaceResolutionConfig,
    language?: string
  ): Map<string, import('./namespace_imports').NamespaceExport> {
    const lang = language || this.detectLanguage(targetFile);
    const resolver = NamespaceResolverRegistry.get(lang);
    
    if (!resolver) {
      return new Map();
    }
    
    return resolver.resolveNamespaceExports(targetFile, config);
  }
  
  /**
   * Detect language from file path
   */
  private static detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'js':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'jsx':
        return 'jsx';
      case 'ts':
      case 'mts':
      case 'cts':
        return 'typescript';
      case 'tsx':
        return 'tsx';
      case 'py':
        return 'python';
      case 'rs':
        return 'rust';
      default:
        return 'unknown';
    }
  }
}

// Initialize JavaScript/TypeScript resolvers on module load
import('./namespace_imports.javascript').then(({ registerJavaScriptResolvers }) => {
  registerJavaScriptResolvers();
});