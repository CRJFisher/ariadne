/**
 * Tests for import type resolver
 */

import { describe, it, expect } from 'vitest';
import {
  build_import_type_map,
} from './import_type_resolver';
import { FilePath, ImportInfo } from '@ariadnejs/types';

describe('Import Type Resolver', () => {
  const test_imports: ImportInfo[] = [
    {
      name: 'User',
      source: './models/user',
      kind: 'default',
      location: { line: 1, column: 0, file_path: 'test.ts' as FilePath, end_line: 1, end_column: 0 }
    },
    {
      name: 'Component',
      source: 'react',
      alias: 'ReactComponent',
      kind: 'named',
      location: { line: 2, column: 0, file_path: 'test.ts' as FilePath, end_line: 2, end_column: 0 }
    },
    {
      name: '*',
      source: 'lodash',
      namespace_name: '_',
      kind: 'namespace',
      location: { line: 3, column: 0, file_path: 'test.ts' as FilePath, end_line: 3, end_column: 0 }
    },
    {
      name: 'UserType',
      source: './types',
      kind: 'named',
      is_type_only: true,
      location: { line: 4, column: 0, file_path: 'test.ts' as FilePath, end_line: 4, end_column: 0 }
    }
  ];


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

});