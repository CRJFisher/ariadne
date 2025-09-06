/**
 * Tests for method hierarchy resolver
 */

import { describe, it, expect } from 'vitest';
import {
  enrich_method_calls_with_hierarchy,
  resolve_method_in_hierarchy,
  analyze_virtual_call,
  get_available_methods,
  is_inherited_method,
  MethodCallWithHierarchy
} from './method_hierarchy_resolver';
import { ClassHierarchy, ClassInfo } from '../../inheritance/class_hierarchy';
import { MethodCallInfo } from '@ariadnejs/types';
import { Def } from '@ariadnejs/types';

describe('method_hierarchy_resolver', () => {
  // Helper to create a test class definition
  function create_class_def(
    name: string,
    methods: string[] = [],
    kind: 'class' | 'interface' = 'class'
  ): Def {
    return {
      symbol_id: name,
      symbol_name: name,
      symbol_kind: kind,
      file_path: `test/${name}.ts`,
      range: {
        start: { line: 0, column: 0 },
        end: { line: 10, column: 0 }
      },
      members: methods.map(method => ({
        symbol_id: `${name}.${method}`,
        symbol_name: method,
        symbol_kind: 'method',
        file_path: `test/${name}.ts`,
        range: {
          start: { line: 1, column: 0 },
          end: { line: 2, column: 0 }
        }
      }))
    };
  }

  // Helper to create a test hierarchy
  function create_test_hierarchy(): ClassHierarchy {
    const hierarchy: ClassHierarchy = {
      classes: new Map(),
      edges: [],
      roots: [],
      language: 'typescript'
    };

    // Create a simple inheritance chain: Base -> Derived -> Concrete
    const base_def = create_class_def('Base', ['method1', 'method2']);
    const derived_def = create_class_def('Derived', ['method2', 'method3']);
    const concrete_def = create_class_def('Concrete', ['method3', 'method4']);
    const interface_def = create_class_def('IService', ['serve'], 'interface');

    // Base class
    const base_info: ClassInfo = {
      definition: base_def,
      implemented_interfaces: [],
      interface_defs: [],
      subclasses: [derived_def],
      all_ancestors: [],
      all_descendants: [derived_def, concrete_def],
      method_resolution_order: [base_def]
    };

    // Derived class
    const derived_info: ClassInfo = {
      definition: derived_def,
      parent_class: 'Base',
      parent_class_def: base_def,
      implemented_interfaces: ['IService'],
      interface_defs: [interface_def],
      subclasses: [concrete_def],
      all_ancestors: [base_def],
      all_descendants: [concrete_def],
      method_resolution_order: [derived_def, base_def]
    };

    // Concrete class
    const concrete_info: ClassInfo = {
      definition: concrete_def,
      parent_class: 'Derived',
      parent_class_def: derived_def,
      implemented_interfaces: [],
      interface_defs: [],
      subclasses: [],
      all_ancestors: [derived_def, base_def],
      all_descendants: [],
      method_resolution_order: [concrete_def, derived_def, base_def]
    };

    // Interface
    const interface_info: ClassInfo = {
      definition: interface_def,
      implemented_interfaces: [],
      interface_defs: [],
      subclasses: [],
      all_ancestors: [],
      all_descendants: [],
      method_resolution_order: [interface_def]
    };

    hierarchy.classes.set('Base', base_info);
    hierarchy.classes.set('Derived', derived_info);
    hierarchy.classes.set('Concrete', concrete_info);
    hierarchy.classes.set('IService', interface_info);
    hierarchy.roots = [base_def, interface_def];

    return hierarchy;
  }

  describe('enrich_method_calls_with_hierarchy', () => {
    it('should enrich method calls with hierarchy information', () => {
      const hierarchy = create_test_hierarchy();
      
      const method_calls: MethodCallInfo[] = [
        {
          caller_name: 'main',
          method_name: 'method2',
          receiver_name: 'obj',
          receiver_type: 'Concrete',
          location: { line: 10, column: 5 }
        }
      ];

      const enriched = enrich_method_calls_with_hierarchy(method_calls, hierarchy);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].defining_class_resolved).toBe('Derived');
      expect(enriched[0].is_override).toBe(true);
      expect(enriched[0].override_chain).toContain('Derived');
    });

    it('should handle missing hierarchy gracefully', () => {
      const method_calls: MethodCallInfo[] = [
        {
          caller_name: 'main',
          method_name: 'test',
          receiver_name: 'obj',
          location: { line: 10, column: 5 }
        }
      ];

      const enriched = enrich_method_calls_with_hierarchy(method_calls, undefined);
      
      expect(enriched).toHaveLength(1);
      expect(enriched[0].defining_class_resolved).toBeUndefined();
    });

    it('should identify virtual method calls', () => {
      const hierarchy = create_test_hierarchy();
      
      const method_calls: MethodCallInfo[] = [
        {
          caller_name: 'main',
          method_name: 'method3',
          receiver_name: 'obj',
          receiver_type: 'Derived',
          location: { line: 10, column: 5 }
        }
      ];

      const enriched = enrich_method_calls_with_hierarchy(method_calls, hierarchy);

      expect(enriched[0].is_virtual_call).toBe(true);
      expect(enriched[0].possible_targets).toContain('Derived');
      expect(enriched[0].possible_targets).toContain('Concrete');
    });
  });

  describe('resolve_method_in_hierarchy', () => {
    it('should resolve method defined in the same class', () => {
      const hierarchy = create_test_hierarchy();
      
      const resolution = resolve_method_in_hierarchy('Base', 'method1', hierarchy);
      
      expect(resolution).toBeDefined();
      expect(resolution?.defining_class).toBe('Base');
      expect(resolution?.is_override).toBe(false);
    });

    it('should resolve inherited method', () => {
      const hierarchy = create_test_hierarchy();
      
      const resolution = resolve_method_in_hierarchy('Concrete', 'method1', hierarchy);
      
      expect(resolution).toBeDefined();
      expect(resolution?.defining_class).toBe('Base');
      expect(resolution?.is_override).toBe(false);
    });

    it('should detect method override', () => {
      const hierarchy = create_test_hierarchy();
      
      const resolution = resolve_method_in_hierarchy('Derived', 'method2', hierarchy);
      
      expect(resolution).toBeDefined();
      expect(resolution?.defining_class).toBe('Derived');
      expect(resolution?.is_override).toBe(true); // method2 is defined in both Derived and Base (parent)
      expect(resolution?.override_chain).toContain('Derived');
    });

    it('should resolve interface methods', () => {
      const hierarchy = create_test_hierarchy();
      
      const resolution = resolve_method_in_hierarchy('Derived', 'serve', hierarchy);
      
      expect(resolution).toBeDefined();
      expect(resolution?.defining_class).toBe('IService');
      expect(resolution?.is_interface_method).toBe(true);
    });

    it('should return undefined for non-existent method', () => {
      const hierarchy = create_test_hierarchy();
      
      const resolution = resolve_method_in_hierarchy('Base', 'nonexistent', hierarchy);
      
      expect(resolution).toBeUndefined();
    });
  });

  describe('analyze_virtual_call', () => {
    it('should identify virtual calls with multiple targets', () => {
      const hierarchy = create_test_hierarchy();
      
      const virtual_info = analyze_virtual_call('Derived', 'method3', hierarchy);
      
      expect(virtual_info).toBeDefined();
      expect(virtual_info?.is_virtual).toBe(true);
      expect(virtual_info?.possible_targets).toHaveLength(2);
      expect(virtual_info?.possible_targets).toContain('Derived');
      expect(virtual_info?.possible_targets).toContain('Concrete');
    });

    it('should identify non-virtual calls', () => {
      const hierarchy = create_test_hierarchy();
      
      const virtual_info = analyze_virtual_call('Concrete', 'method4', hierarchy);
      
      expect(virtual_info).toBeDefined();
      expect(virtual_info?.is_virtual).toBe(false);
      expect(virtual_info?.possible_targets).toHaveLength(1);
      expect(virtual_info?.possible_targets).toContain('Concrete');
    });

    it('should handle unknown classes', () => {
      const hierarchy = create_test_hierarchy();
      
      const virtual_info = analyze_virtual_call('Unknown', 'method1', hierarchy);
      
      expect(virtual_info).toBeUndefined();
    });
  });

  describe('get_available_methods', () => {
    it('should return all methods including inherited', () => {
      const hierarchy = create_test_hierarchy();
      
      const methods = get_available_methods('Concrete', hierarchy);
      
      expect(methods.size).toBe(5); // method1, method2, method3, method4, serve
      expect(methods.get('method1')).toBe('Base');
      expect(methods.get('method2')).toBe('Derived');
      expect(methods.get('method3')).toBe('Concrete');
      expect(methods.get('method4')).toBe('Concrete');
      expect(methods.get('serve')).toBe('IService');
    });

    it('should handle base class with no inheritance', () => {
      const hierarchy = create_test_hierarchy();
      
      const methods = get_available_methods('Base', hierarchy);
      
      expect(methods.size).toBe(2);
      expect(methods.get('method1')).toBe('Base');
      expect(methods.get('method2')).toBe('Base');
    });
  });

  describe('is_inherited_method', () => {
    it('should identify inherited methods', () => {
      const hierarchy = create_test_hierarchy();
      
      expect(is_inherited_method('Concrete', 'method1', hierarchy)).toBe(true);
      expect(is_inherited_method('Concrete', 'method2', hierarchy)).toBe(true);
    });

    it('should identify non-inherited methods', () => {
      const hierarchy = create_test_hierarchy();
      
      expect(is_inherited_method('Concrete', 'method4', hierarchy)).toBe(false);
      expect(is_inherited_method('Base', 'method1', hierarchy)).toBe(false);
    });

    it('should handle non-existent methods', () => {
      const hierarchy = create_test_hierarchy();
      
      expect(is_inherited_method('Concrete', 'nonexistent', hierarchy)).toBe(false);
    });
  });
});