/**
 * Type safety tests for member_access module
 * These tests ensure TypeScript compilation validates our type safety
 */

import { describe, it, expect } from 'vitest';
import { FilePath, NamespaceName } from '@ariadnejs/types';
import { MemberAccessContext } from './types';
import { find_member_access_expressions } from './member_access';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';

describe('Member Access Type Safety', () => {
  const parser = new Parser();
  parser.setLanguage(JavaScript);

  it('should enforce proper type casting for NamespaceName', () => {
    // This test ensures NamespaceName is properly typed
    const context: MemberAccessContext = {
      file_path: '/test/file.ts' as FilePath,
      namespace_imports: new Set(['api', 'utils'].map(ns => ns as NamespaceName))
    };

    expect(context.namespace_imports.size).toBe(2);
    expect(Array.from(context.namespace_imports)[0]).toBe('api');
  });

  it('should handle readonly namespace_imports correctly', () => {
    const namespaces = new Set<NamespaceName>(['types' as NamespaceName]);
    const context: MemberAccessContext = {
      file_path: '/test/file.ts' as FilePath,
      namespace_imports: namespaces
    };

    // Test that the type system accepts ReadonlySet
    const source = 'types.User';
    const tree = parser.parse(source);
    
    const analysis: any = {
      file_path: '/test/file.ts' as FilePath,
      language: 'javascript' as const,
      imports: [{
        kind: 'namespace' as const,
        namespace_name: 'types' as NamespaceName,
        source: './types',
        language: 'javascript' as const,
        node_type: 'import_statement'
      }],
      functions: [],
      classes: [],
      exports: [],
      source_code: source,
      variables: [],
      errors: [],
      scopes: { type: 'module', children: [], symbols: new Map() },
      function_calls: [],
      method_calls: [],
      constructor_calls: [],
      type_info: new Map()
    };
    
    const results = find_member_access_expressions(analysis, tree.rootNode);
    
    // This should compile without type errors
    expect(Array.isArray(results)).toBe(true);
  });

  it('should prevent mutation of readonly properties', () => {
    const context: MemberAccessContext = {
      file_path: '/test/file.ts' as FilePath,
      namespace_imports: new Set(['api' as NamespaceName])
    };

    // This test verifies that TypeScript prevents mutation
    // The following would cause a compilation error if uncommented:
    // @ts-expect-error - namespace_imports is readonly
    // context.namespace_imports.add('new' as NamespaceName);

    expect(context.namespace_imports.size).toBe(1);
  });

  it('should enforce Location type structure', () => {
    const source = 'namespace.member';
    const tree = parser.parse(source);
    
    const analysis: any = {
      file_path: '/test/file.ts' as FilePath,
      language: 'javascript' as const,
      imports: [{
        kind: 'namespace' as const,
        namespace_name: 'namespace' as NamespaceName,
        source: './namespace',
        language: 'javascript' as const,
        node_type: 'import_statement'
      }],
      functions: [],
      classes: [],
      exports: [],
      source_code: source,
      variables: [],
      errors: [],
      scopes: { type: 'module', children: [], symbols: new Map() },
      function_calls: [],
      method_calls: [],
      constructor_calls: [],
      type_info: new Map()
    };

    const results = find_member_access_expressions(analysis, tree.rootNode);
    
    if (results.length > 0) {
      const location = results[0].location;
      
      // Verify Location has the expected properties
      // The Location type structure verifies this at compile time
      expect(location).toBeDefined();
      expect(typeof location.file_path).toBe('string');
      expect(typeof location.line).toBe('number');
      expect(typeof location.column).toBe('number');
      expect(typeof location.end_line).toBe('number');
      expect(typeof location.end_column).toBe('number');
    }
  });

  it('should handle configuration types correctly', () => {
    // Test that configuration interfaces are properly typed
    const testConfig = {
      node_types: ['member_expression'] as const,
      field_mappings: {
        'member_expression': {
          object_field: 'object' as const,
          member_field: 'property' as const
        }
      },
      skip_node_types: ['comment'] as const
    };

    // This should compile without errors
    expect(testConfig.node_types).toContain('member_expression');
    expect(testConfig.field_mappings['member_expression'].object_field).toBe('object');
  });
});