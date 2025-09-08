/**
 * Unit tests for namespace resolution
 * 
 * Tests the namespace resolution functionality in isolation
 */

import { describe, it, expect } from 'vitest';
import { is_namespace_import } from './namespace_resolution';
import { Import, Language } from '@ariadnejs/types';

describe('Namespace Resolution Unit Tests', () => {
  describe('is_namespace_import', () => {
    it('should identify TypeScript namespace imports', () => {
      const tsNamespaceImport: Import = {
        source_name: '*',
        source: './types',
        local_name: 'types',
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(tsNamespaceImport, 'typescript')).toBe(true);
    });
    
    it('should identify JavaScript namespace imports', () => {
      const jsNamespaceImport: Import = {
        source_name: '*',
        source: './utils',
        local_name: 'utils',
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(jsNamespaceImport, 'javascript')).toBe(true);
    });
    
    it('should identify Python module imports', () => {
      const pyModuleImport: Import = {
        source_name: undefined,
        source: 'utils',
        local_name: 'utils',
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(pyModuleImport, 'python')).toBe(true);
    });
    
    it('should identify Python wildcard imports', () => {
      const pyWildcardImport: Import = {
        source_name: '*',
        source: 'helpers',
        local_name: undefined,
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(pyWildcardImport, 'python')).toBe(true);
    });
    
    it('should identify Rust wildcard imports', () => {
      const rustWildcardImport: Import = {
        source_name: '*',
        source: 'module',
        local_name: undefined,
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(rustWildcardImport, 'rust')).toBe(true);
    });
    
    it('should reject non-namespace imports', () => {
      const namedImport: Import = {
        source_name: 'Component',
        source: 'react',
        local_name: 'Component',
        location: { line: 1, column: 0 }
      };
      
      expect(is_namespace_import(namedImport, 'typescript')).toBe(false);
    });
  });
});