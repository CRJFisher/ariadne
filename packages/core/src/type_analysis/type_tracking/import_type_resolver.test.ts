/**
 * Tests for import type resolver
 */

import { describe, it, expect } from 'vitest';
import {
  resolve_type_from_imports,
  build_import_type_map,
  is_imported_type,
  get_qualified_type_name,
  filter_type_imports
} from './import_type_resolver';
import { ImportInfo } from '@ariadnejs/types';

describe('Import Type Resolver', () => {
  const test_imports: ImportInfo[] = [
    {
      name: 'User',
      source: './models/user',
      kind: 'default',
      location: { line: 1, column: 0 }
    },
    {
      name: 'Component',
      source: 'react',
      alias: 'ReactComponent',
      kind: 'named',
      location: { line: 2, column: 0 }
    },
    {
      name: '*',
      source: 'lodash',
      namespace_name: '_',
      kind: 'namespace',
      location: { line: 3, column: 0 }
    },
    {
      name: 'UserType',
      source: './types',
      kind: 'named',
      is_type_only: true,
      location: { line: 4, column: 0 }
    }
  ];

  describe('resolve_type_from_imports', () => {
    it('should resolve default import', () => {
      const result = resolve_type_from_imports('User', test_imports);
      expect(result).toEqual({
        class_name: 'User',
        source_module: './models/user',
        local_name: 'User',
        is_default: true,
        is_type_only: undefined
      });
    });

    it('should resolve aliased named import', () => {
      const result = resolve_type_from_imports('ReactComponent', test_imports);
      expect(result).toEqual({
        class_name: 'Component',
        source_module: 'react',
        local_name: 'ReactComponent',
        is_default: false,
        is_type_only: undefined
      });
    });

    it('should resolve namespace member', () => {
      const result = resolve_type_from_imports('_.debounce', test_imports);
      expect(result).toEqual({
        class_name: 'debounce',
        source_module: 'lodash',
        local_name: '_.debounce',
        is_default: false,
        is_type_only: undefined
      });
    });

    it('should resolve type-only import', () => {
      const result = resolve_type_from_imports('UserType', test_imports);
      expect(result).toEqual({
        class_name: 'UserType',
        source_module: './types',
        local_name: 'UserType',
        is_default: false,
        is_type_only: true
      });
    });

    it('should return undefined for non-imported type', () => {
      const result = resolve_type_from_imports('LocalClass', test_imports);
      expect(result).toBeUndefined();
    });
  });

  describe('build_import_type_map', () => {
    it('should build map of imported types', () => {
      const map = build_import_type_map(test_imports);
      
      expect(map.has('User')).toBe(true);
      expect(map.has('ReactComponent')).toBe(true);
      expect(map.has('_')).toBe(true);
      expect(map.has('UserType')).toBe(true);
      expect(map.has('Component')).toBe(false); // Should use alias
    });
  });

  describe('is_imported_type', () => {
    it('should return true for imported types', () => {
      expect(is_imported_type('User', test_imports)).toBe(true);
      expect(is_imported_type('ReactComponent', test_imports)).toBe(true);
      expect(is_imported_type('UserType', test_imports)).toBe(true);
    });

    it('should return false for non-imported types', () => {
      expect(is_imported_type('LocalClass', test_imports)).toBe(false);
      expect(is_imported_type('String', test_imports)).toBe(false);
    });
  });

  describe('get_qualified_type_name', () => {
    it('should return qualified name for imported type', () => {
      expect(get_qualified_type_name('User', test_imports))
        .toBe('./models/user#User');
      expect(get_qualified_type_name('ReactComponent', test_imports))
        .toBe('react#Component');
    });

    it('should return local name for non-imported type', () => {
      expect(get_qualified_type_name('LocalClass', test_imports))
        .toBe('LocalClass');
    });
  });

  describe('filter_type_imports', () => {
    it('should filter type-only imports in TypeScript', () => {
      const filtered = filter_type_imports(test_imports, 'typescript');
      
      // Should include type-only import
      expect(filtered.some(i => i.name === 'UserType')).toBe(true);
      
      // Should include uppercase names (conventionally types)
      expect(filtered.some(i => i.name === 'User')).toBe(true);
      expect(filtered.some(i => i.name === 'Component')).toBe(true);
    });

    it('should filter uppercase names in JavaScript', () => {
      const filtered = filter_type_imports(test_imports, 'javascript');
      
      // Should include uppercase names
      expect(filtered.some(i => i.name === 'User')).toBe(true);
      expect(filtered.some(i => i.name === 'Component')).toBe(true);
    });
  });
});