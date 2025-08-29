/**
 * Tests for interface implementation tracking
 * 
 * Test contract that all language-specific implementations must satisfy:
 * 1. Extract interface definitions
 * 2. Find interface implementations
 * 3. Check implementation compliance
 * 4. Track incomplete implementations
 * 5. Handle interface inheritance
 */

import { describe, it, expect } from 'vitest';
import { Def } from '@ariadnejs/types';
import {
  InterfaceDefinition,
  InterfaceImplementation,
  InterfaceImplementationMap,
  extract_interface_definition,
  check_implementation_compliance,
  build_interface_implementation_map,
  get_interface_implementors,
  get_implemented_interfaces,
  validate_all_implementations
} from './interface_implementation';
import { ClassHierarchy, ClassInfo } from '../class_hierarchy/class_hierarchy';

describe('interface_implementation core', () => {
  describe('extract_interface_definition', () => {
    it('should extract interface with methods and properties', () => {
      const interface_def: Def = {
        name: 'IShape',
        symbol_id: 'test.ts:IShape',
        symbol_kind: 'interface',
        file_path: 'test.ts',
        range: {
          start: { row: 0, column: 0 },
          end: { row: 5, column: 1 }
        }
      };
      
      const members: Def[] = [
        {
          name: 'area',
          symbol_id: 'test.ts:area',
          symbol_kind: 'method',
          file_path: 'test.ts',
          range: {
            start: { row: 1, column: 2 },
            end: { row: 1, column: 20 }
          }
        },
        {
          name: 'width',
          symbol_id: 'test.ts:width',
          symbol_kind: 'property',
          file_path: 'test.ts',
          range: {
            start: { row: 2, column: 2 },
            end: { row: 2, column: 15 }
          }
        }
      ];
      
      const result = extract_interface_definition(interface_def, members);
      
      expect(result.definition).toBe(interface_def);
      expect(result.required_methods).toHaveLength(1);
      expect(result.required_methods[0].name).toBe('area');
      expect(result.required_properties).toHaveLength(1);
      expect(result.required_properties![0].name).toBe('width');
      expect(result.language).toBe('ts');
    });
  });
  
  describe('check_implementation_compliance', () => {
    it('should detect complete implementation', () => {
      const interface_def: InterfaceDefinition = {
        definition: {
          name: 'IShape',
          symbol_id: 'test.ts:IShape',
          symbol_kind: 'interface',
          file_path: 'test.ts',
          range: {
            start: { row: 0, column: 0 },
            end: { row: 3, column: 1 }
          }
        },
        required_methods: [
          { name: 'area', parameters: [], return_type: 'number' }
        ],
        required_properties: [
          { name: 'width', type: 'number' }
        ],
        extends_interfaces: [],
        language: 'typescript'
      };
      
      const class_def: Def = {
        name: 'Rectangle',
        symbol_id: 'test.ts:Rectangle',
        symbol_kind: 'class',
        file_path: 'test.ts',
        range: {
          start: { row: 5, column: 0 },
          end: { row: 10, column: 1 }
        }
      };
      
      const class_methods: Def[] = [
        {
          name: 'area',
          symbol_id: 'test.ts:Rectangle.area',
          symbol_kind: 'method',
          file_path: 'test.ts',
          range: {
            start: { row: 6, column: 2 },
            end: { row: 6, column: 30 }
          }
        }
      ];
      
      const class_properties: Def[] = [
        {
          name: 'width',
          symbol_id: 'test.ts:Rectangle.width',
          symbol_kind: 'property',
          file_path: 'test.ts',
          range: {
            start: { row: 7, column: 2 },
            end: { row: 7, column: 20 }
          }
        }
      ];
      
      const result = check_implementation_compliance(
        class_def,
        interface_def,
        class_methods,
        class_properties
      );
      
      expect(result.implementor).toBe(class_def);
      expect(result.interface_def).toBe(interface_def);
      expect(result.is_complete).toBe(true);
      expect(result.missing_members).toHaveLength(0);
      expect(result.implemented_methods.size).toBe(1);
      expect(result.implemented_properties?.size).toBe(1);
    });
    
    it('should detect incomplete implementation', () => {
      const interface_def: InterfaceDefinition = {
        definition: {
          name: 'IShape',
          symbol_id: 'test.ts:IShape',
          symbol_kind: 'interface',
          file_path: 'test.ts',
          range: {
            start: { row: 0, column: 0 },
            end: { row: 3, column: 1 }
          }
        },
        required_methods: [
          { name: 'area', parameters: [], return_type: 'number' },
          { name: 'perimeter', parameters: [], return_type: 'number' }
        ],
        extends_interfaces: [],
        language: 'typescript'
      };
      
      const class_def: Def = {
        name: 'Rectangle',
        symbol_id: 'test.ts:Rectangle',
        symbol_kind: 'class',
        file_path: 'test.ts',
        range: {
          start: { row: 5, column: 0 },
          end: { row: 10, column: 1 }
        }
      };
      
      const class_methods: Def[] = [
        {
          name: 'area',
          symbol_id: 'test.ts:Rectangle.area',
          symbol_kind: 'method',
          file_path: 'test.ts',
          range: {
            start: { row: 6, column: 2 },
            end: { row: 6, column: 30 }
          }
        }
      ];
      
      const result = check_implementation_compliance(
        class_def,
        interface_def,
        class_methods
      );
      
      expect(result.is_complete).toBe(false);
      expect(result.missing_members).toContain('method: perimeter');
      expect(result.implemented_methods.size).toBe(1);
    });
  });
  
  describe('build_interface_implementation_map', () => {
    it('should build complete implementation map', () => {
      const interfaces: InterfaceDefinition[] = [
        {
          definition: {
            name: 'IShape',
            symbol_id: 'test.ts:IShape',
            symbol_kind: 'interface',
            file_path: 'test.ts',
            range: {
              start: { row: 0, column: 0 },
              end: { row: 3, column: 1 }
            }
          },
          required_methods: [
            { name: 'area', parameters: [], return_type: 'number' }
          ],
          extends_interfaces: [],
          language: 'typescript'
        }
      ];
      
      const hierarchy: ClassHierarchy = {
        classes: new Map([
          ['test.ts:Rectangle', {
            definition: {
              name: 'Rectangle',
              symbol_id: 'test.ts:Rectangle',
              symbol_kind: 'class',
              file_path: 'test.ts',
              range: {
                start: { row: 5, column: 0 },
                end: { row: 10, column: 1 }
              }
            },
            implemented_interfaces: ['IShape'],
            interface_defs: [],
            subclasses: [],
            all_ancestors: [],
            all_descendants: [],
            method_resolution_order: []
          } as ClassInfo]
        ]),
        edges: [],
        roots: [],
        language: 'typescript'
      };
      
      const class_members = new Map([
        ['Rectangle', {
          methods: [
            {
              name: 'area',
              symbol_id: 'test.ts:Rectangle.area',
              symbol_kind: 'method',
              file_path: 'test.ts',
              range: {
                start: { row: 6, column: 2 },
                end: { row: 6, column: 30 }
              }
            }
          ]
        }]
      ]);
      
      const result = build_interface_implementation_map(
        interfaces,
        hierarchy,
        class_members
      );
      
      expect(result.interfaces.size).toBe(1);
      expect(result.interfaces.has('IShape')).toBe(true);
      expect(result.implementations.get('IShape')).toHaveLength(1);
      expect(result.class_interfaces.get('Rectangle')).toEqual(['IShape']);
      expect(result.incomplete_implementations).toHaveLength(0);
    });
  });
  
  describe('get_interface_implementors', () => {
    it('should return all implementors of an interface', () => {
      const impl_map: InterfaceImplementationMap = {
        interfaces: new Map(),
        implementations: new Map([
          ['IShape', [
            {
              implementor: {
                name: 'Rectangle',
                symbol_id: 'test.ts:Rectangle',
                symbol_kind: 'class',
                file_path: 'test.ts',
                range: {
                  start: { row: 5, column: 0 },
                  end: { row: 10, column: 1 }
                }
              },
              interface_def: {} as InterfaceDefinition,
              implemented_methods: new Map(),
              is_complete: true,
              missing_members: [],
              language: 'typescript'
            },
            {
              implementor: {
                name: 'Circle',
                symbol_id: 'test.ts:Circle',
                symbol_kind: 'class',
                file_path: 'test.ts',
                range: {
                  start: { row: 12, column: 0 },
                  end: { row: 17, column: 1 }
                }
              },
              interface_def: {} as InterfaceDefinition,
              implemented_methods: new Map(),
              is_complete: true,
              missing_members: [],
              language: 'typescript'
            }
          ]]
        ]),
        class_interfaces: new Map(),
        incomplete_implementations: [],
        language: 'typescript'
      };
      
      const result = get_interface_implementors('IShape', impl_map);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Rectangle');
      expect(result[1].name).toBe('Circle');
    });
  });
  
  describe('validate_all_implementations', () => {
    it('should validate and report incomplete implementations', () => {
      const impl_map: InterfaceImplementationMap = {
        interfaces: new Map(),
        implementations: new Map(),
        class_interfaces: new Map(),
        incomplete_implementations: [
          {
            implementor: {
              name: 'PartialRect',
              symbol_id: 'test.ts:PartialRect',
              symbol_kind: 'class',
              file_path: 'test.ts',
              range: {
                start: { row: 20, column: 0 },
                end: { row: 25, column: 1 }
              }
            },
            interface_def: {
              definition: {
                name: 'IShape',
                symbol_id: 'test.ts:IShape',
                symbol_kind: 'interface',
                file_path: 'test.ts',
                range: {
                  start: { row: 0, column: 0 },
                  end: { row: 3, column: 1 }
                }
              },
              required_methods: [],
              extends_interfaces: [],
              language: 'typescript'
            },
            implemented_methods: new Map(),
            is_complete: false,
            missing_members: ['method: area', 'property: width'],
            language: 'typescript'
          }
        ],
        language: 'typescript'
      };
      
      const result = validate_all_implementations(impl_map);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('PartialRect does not fully implement IShape');
      expect(result.errors[0]).toContain('Missing: method: area, property: width');
    });
  });
});