/**
 * Tests for TypeScript-specific method override handling
 */

import { describe, it, expect } from 'vitest';
import { handle_typescript_overrides } from './method_override.typescript.bespoke';
import { MethodOverrideContext } from './method_override.generic';
import { get_language_config } from './language_configs';

describe('TypeScript Method Override Bespoke Handler', () => {
  it('should mark overrides as explicit when TypeScript supports it', () => {
    const config = get_language_config('typescript')!;
    
    const method1 = {
      name: 'speak',
      kind: 'method' as const,
      file_path: 'test.ts',
      start_line: 10,
      start_column: 0,
      end_line: 12,
      end_column: 0,
      extent_start_line: 10,
      extent_start_column: 0,
      extent_end_line: 12,
      extent_end_column: 0
    };
    
    const method2 = {
      name: 'speak',
      kind: 'method' as const,
      file_path: 'test.ts',
      start_line: 20,
      start_column: 0,
      end_line: 22,
      end_column: 0,
      extent_start_line: 20,
      extent_start_column: 0,
      extent_end_line: 22,
      extent_end_column: 0
    };
    
    const context: MethodOverrideContext = {
      config,
      hierarchy: {
        classes: new Map(),
        edges: [],
        roots: [],
        language: 'typescript'
      },
      all_methods: new Map(),
      overrides: new Map([
        ['Dog.speak', {
          method_def: method2,
          overrides: method1,
          overridden_by: [],
          override_chain: [method1, method2],
          is_abstract: false,
          is_final: false
        }]
      ]),
      override_edges: [{
        method: method2,
        base_method: method1,
        override_chain: [method1, method2],
        is_abstract: false,
        is_virtual: true,
        is_explicit: false,
        language: 'typescript'
      }],
      leaf_methods: [],
      abstract_methods: []
    };
    
    handle_typescript_overrides(context);
    
    // Should mark override as potentially explicit
    expect(context.override_edges[0].is_explicit).toBe(true);
  });
  
  it('should collect abstract methods', () => {
    const config = get_language_config('typescript')!;
    
    const abstract_method = {
      name: 'area',
      kind: 'method' as const,
      file_path: 'test.ts',
      start_line: 3,
      start_column: 0,
      end_line: 3,
      end_column: 0,
      extent_start_line: 3,
      extent_start_column: 0,
      extent_end_line: 3,
      extent_end_column: 0
    };
    
    const context: MethodOverrideContext = {
      config,
      hierarchy: {
        classes: new Map(),
        edges: [],
        roots: [],
        language: 'typescript'
      },
      all_methods: new Map(),
      overrides: new Map([
        ['Shape.area', {
          method_def: abstract_method,
          overrides: undefined,
          overridden_by: [],
          override_chain: [abstract_method],
          is_abstract: true,
          is_final: false
        }]
      ]),
      override_edges: [],
      leaf_methods: [],
      abstract_methods: []
    };
    
    handle_typescript_overrides(context);
    
    // Should add abstract method to the list
    expect(context.abstract_methods).toContain(abstract_method);
  });
});