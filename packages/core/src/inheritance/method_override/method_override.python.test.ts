/**
 * Tests for Python-specific method override handling
 */

import { describe, it, expect } from 'vitest';
import { handle_python_overrides } from './method_override.python.bespoke';
import { MethodOverrideContext } from './method_override.generic';
import { get_language_config } from './language_configs';

describe('Python Method Override Bespoke Handler', () => {
  it('should calculate MRO for classes', () => {
    const config = get_language_config('python')!;
    
    const animal_def = {
      name: 'Animal',
      kind: 'class' as const,
      file_path: 'test.py',
      start_line: 1,
      start_column: 0,
      end_line: 5,
      end_column: 0,
      extent_start_line: 1,
      extent_start_column: 0,
      extent_end_line: 5,
      extent_end_column: 0
    };
    
    const dog_def = {
      name: 'Dog',
      kind: 'class' as const,
      file_path: 'test.py',
      start_line: 7,
      start_column: 0,
      end_line: 10,
      end_column: 0,
      extent_start_line: 7,
      extent_start_column: 0,
      extent_end_line: 10,
      extent_end_column: 0
    };
    
    const context: MethodOverrideContext = {
      config,
      hierarchy: {
        classes: new Map([
          ['Animal', {
            definition: animal_def,
            parent_class: undefined,
            parent_class_def: undefined,
            implemented_interfaces: [],
            interface_defs: [],
            subclasses: [dog_def],
            all_ancestors: [],
            all_descendants: [dog_def],
            method_resolution_order: []
          }],
          ['Dog', {
            definition: dog_def,
            parent_class: 'Animal',
            parent_class_def: animal_def,
            implemented_interfaces: [],
            interface_defs: [],
            subclasses: [],
            all_ancestors: [animal_def],
            all_descendants: [],
            method_resolution_order: []
          }]
        ]),
        edges: [],
        roots: [animal_def],
        language: 'python'
      },
      all_methods: new Map(),
      overrides: new Map(),
      override_edges: [],
      leaf_methods: [],
      abstract_methods: []
    };
    
    handle_python_overrides(context);
    
    // Should calculate MRO for Dog
    const dog = context.hierarchy.classes.get('Dog');
    expect(dog?.method_resolution_order).toHaveLength(2);
    expect(dog?.method_resolution_order[0]).toBe(dog_def);
    expect(dog?.method_resolution_order[1]).toBe(animal_def);
  });
  
  it('should handle abstract methods', () => {
    const config = get_language_config('python')!;
    
    const abstract_method = {
      name: 'speak',
      kind: 'method' as const,
      file_path: 'test.py',
      start_line: 5,
      start_column: 0,
      end_line: 6,
      end_column: 0,
      extent_start_line: 5,
      extent_start_column: 0,
      extent_end_line: 6,
      extent_end_column: 0
    };
    
    const context: MethodOverrideContext = {
      config,
      hierarchy: {
        classes: new Map(),
        edges: [],
        roots: [],
        language: 'python'
      },
      all_methods: new Map(),
      overrides: new Map([
        ['Animal.speak', {
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
    
    handle_python_overrides(context);
    
    // Should add abstract method to the list
    expect(context.abstract_methods).toContain(abstract_method);
  });
});