/**
 * Tests for import resolution functionality
 */

import { describe, it, expect } from 'vitest';
import {
  is_namespace_import,
  is_default_import,
  is_named_import,
  is_index_file
} from './import_resolution';
import { ImportedSymbol } from '@ariadnejs/types';

describe('import_resolution', () => {
  // Helper to create test imports
  const create_imported_symbol = (
    name: string,
    is_namespace?: boolean,
    is_default?: boolean,
    local_name?: string
  ): ImportedSymbol => ({
    name,
    is_namespace,
    is_default,
    local_name
  });
  
  describe('import type detection', () => {
    it('should detect namespace imports', () => {
      const namespace_import = create_imported_symbol('*', true);
      expect(is_namespace_import(namespace_import, 'javascript')).toBe(true);
      
      const named_import = create_imported_symbol('foo');
      expect(is_namespace_import(named_import, 'javascript')).toBe(false);
    });
    
    it('should detect default imports', () => {
      const default_import = create_imported_symbol('default', false, true);
      expect(is_default_import(default_import, 'javascript')).toBe(true);
      
      const named_import = create_imported_symbol('foo');
      expect(is_default_import(named_import, 'javascript')).toBe(false);
    });
    
    it('should detect named imports', () => {
      const named_import = create_imported_symbol('foo');
      expect(is_named_import(named_import, 'javascript')).toBe(true);
      
      const namespace_import = create_imported_symbol('*', true);
      expect(is_named_import(namespace_import, 'javascript')).toBe(false);
      
      const default_import = create_imported_symbol('default', false, true);
      expect(is_named_import(default_import, 'javascript')).toBe(false);
    });
  });
  
  describe('file utilities', () => {
    it('should detect index files', () => {
      expect(is_index_file('src/index.js', 'javascript')).toBe(true);
      expect(is_index_file('src/index.ts', 'typescript')).toBe(true);
      expect(is_index_file('src/__init__.py', 'python')).toBe(true);
      expect(is_index_file('src/mod.rs', 'rust')).toBe(true);
      
      expect(is_index_file('src/main.js', 'javascript')).toBe(false);
      expect(is_index_file('src/utils.py', 'python')).toBe(false);
    });
  });
});