/**
 * Unit tests for namespace resolution
 * 
 * Tests the namespace resolution functionality in isolation
 */

import { describe, it, expect } from 'vitest';
import { is_namespace_import } from './namespace_resolution';
import { ImportStatement as Import, Language } from '@ariadnejs/types';

describe('Namespace Resolution Unit Tests', () => {
  describe('is_namespace_import', () => {
    it('should identify TypeScript namespace imports', () => {
      const tsNamespaceImport: Import = {
        source: './types',
        symbol_name: '*' as any,
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(tsNamespaceImport, 'typescript')).toBe(true);
    });
    
    it('should identify JavaScript namespace imports', () => {
      const jsNamespaceImport: Import = {
        source: './utils',
        symbol_name: '*' as any,
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(jsNamespaceImport, 'javascript')).toBe(true);
    });
    
    it('should identify Python module imports', () => {
      const pyModuleImport: Import = {
        source: 'utils',
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(pyModuleImport, 'python')).toBe(true);
    });
    
    it('should identify Python wildcard imports', () => {
      const pyWildcardImport: Import = {
        source: 'helpers',
        symbol_name: '*' as any,
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(pyWildcardImport, 'python')).toBe(true);
    });
    
    it('should identify Rust wildcard imports', () => {
      const rustWildcardImport: Import = {
        source: 'module::*',
        symbol_name: '*' as any,
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(rustWildcardImport, 'rust')).toBe(true);
    });
    
    it('should reject non-namespace imports', () => {
      const namedImport: Import = {
        source: 'react',
        symbol_name: 'Component' as any,
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(namedImport, 'typescript')).toBe(false);
    });
  });
});