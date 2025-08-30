/**
 * Tests for namespace import helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  is_namespace_access,
  resolve_namespace_member,
  get_namespace_imports,
  is_namespace_binding,
  resolve_nested_namespace,
  expand_namespace_import
} from './namespace_helpers';
import { ImportInfo, ModuleGraph, ModuleNode } from '@ariadnejs/types';

describe('namespace_helpers', () => {
  describe('is_namespace_access', () => {
    it('should detect namespace member access', () => {
      const imports: ImportInfo[] = [
        {
          name: 'utils',
          source: './utils',
          kind: 'namespace',
          namespace_name: 'utils',
          location: { line: 0, column: 0 }
        }
      ];
      
      const result = is_namespace_access('utils.helper', imports);
      expect(result.is_namespace).toBe(true);
      expect(result.namespace_name).toBe('utils');
      expect(result.member_name).toBe('helper');
    });
    
    it('should detect nested namespace access', () => {
      const imports: ImportInfo[] = [
        {
          name: 'lodash',
          source: 'lodash',
          kind: 'namespace',
          namespace_name: 'lodash',
          location: { line: 0, column: 0 }
        }
      ];
      
      const result = is_namespace_access('lodash.string.capitalize', imports);
      expect(result.is_namespace).toBe(true);
      expect(result.namespace_name).toBe('lodash');
      expect(result.member_name).toBe('string');
      expect(result.remaining_path).toEqual(['capitalize']);
    });
    
    it('should return false for non-namespace access', () => {
      const imports: ImportInfo[] = [
        {
          name: 'helper',
          source: './utils',
          kind: 'named',
          location: { line: 0, column: 0 }
        }
      ];
      
      const result = is_namespace_access('helper', imports);
      expect(result.is_namespace).toBe(false);
    });
    
    it('should detect Python module namespace', () => {
      const imports: ImportInfo[] = [
        {
          name: 'os',
          source: 'os',
          kind: 'namespace',
          namespace_name: 'os',
          location: { line: 0, column: 0 }
        }
      ];
      
      const result = is_namespace_access('os.path', imports);
      expect(result.is_namespace).toBe(true);
      expect(result.namespace_name).toBe('os');
      expect(result.member_name).toBe('path');
    });
  });
  
  describe('resolve_namespace_member', () => {
    it('should resolve namespace member without module graph', () => {
      const imports: ImportInfo[] = [
        {
          name: 'utils',
          source: './utils',
          kind: 'namespace',
          namespace_name: 'utils',
          location: { line: 0, column: 0 }
        }
      ];
      
      const result = resolve_namespace_member('utils', 'helper', imports);
      expect(result).toBeDefined();
      expect(result?.source_module).toBe('./utils');
      expect(result?.export_name).toBe('helper');
    });
    
    it('should return undefined for non-existent namespace', () => {
      const imports: ImportInfo[] = [];
      
      const result = resolve_namespace_member('utils', 'helper', imports);
      expect(result).toBeUndefined();
    });
    
    it('should resolve with module graph verification', () => {
      const imports: ImportInfo[] = [
        {
          name: 'utils',
          source: './utils',
          kind: 'namespace',
          namespace_name: 'utils',
          location: { line: 0, column: 0 }
        }
      ];
      
      const module_graph: ModuleGraph = {
        modules: new Map([
          ['./utils', {
            path: './utils',
            imports: new Map(),
            exports: new Map([
              ['helper', {
                name: 'helper',
                local_name: 'helper',
                location: { line: 5, column: 0 },
                is_default: false,
                is_namespace: false
              }]
            ]),
            imported_by: new Set(),
            language: 'javascript'
          } as ModuleNode]
        ]),
        entry_points: new Set(['./utils'])
      };
      
      const result = resolve_namespace_member('utils', 'helper', imports, module_graph);
      expect(result).toBeDefined();
      expect(result?.source_module).toBe('./utils');
      expect(result?.export_name).toBe('helper');
      expect(result?.is_reexport).toBeUndefined();
    });
  });
  
  describe('get_namespace_imports', () => {
    it('should filter only namespace imports', () => {
      const imports: ImportInfo[] = [
        {
          name: 'utils',
          source: './utils',
          kind: 'namespace',
          namespace_name: 'utils',
          location: { line: 0, column: 0 }
        },
        {
          name: 'helper',
          source: './helper',
          kind: 'named',
          location: { line: 1, column: 0 }
        },
        {
          name: 'lodash',
          source: 'lodash',
          kind: 'namespace',
          namespace_name: 'lodash',
          location: { line: 2, column: 0 }
        }
      ];
      
      const namespaces = get_namespace_imports(imports);
      expect(namespaces).toHaveLength(2);
      expect(namespaces[0].name).toBe('utils');
      expect(namespaces[1].name).toBe('lodash');
    });
  });
  
  describe('is_namespace_binding', () => {
    it('should identify namespace bindings', () => {
      const imports: ImportInfo[] = [
        {
          name: 'utils',
          source: './utils',
          kind: 'namespace',
          namespace_name: 'utils',
          location: { line: 0, column: 0 }
        },
        {
          name: 'helper',
          source: './helper',
          kind: 'named',
          location: { line: 1, column: 0 }
        }
      ];
      
      expect(is_namespace_binding('utils', imports)).toBe(true);
      expect(is_namespace_binding('helper', imports)).toBe(false);
      expect(is_namespace_binding('nonexistent', imports)).toBe(false);
    });
  });
  
  describe('resolve_nested_namespace', () => {
    it('should resolve nested namespace paths', () => {
      const imports: ImportInfo[] = [
        {
          name: 'os',
          source: 'os',
          kind: 'namespace',
          namespace_name: 'os',
          location: { line: 0, column: 0 }
        }
      ];
      
      const result = resolve_nested_namespace('os.path.join', imports);
      expect(result).toBeDefined();
      expect(result?.namespace_chain).toEqual(['os', 'path']);
      expect(result?.final_member).toBe('join');
      expect(result?.source_module).toBe('os');
    });
    
    it('should return undefined for non-namespace identifiers', () => {
      const imports: ImportInfo[] = [];
      
      const result = resolve_nested_namespace('regular_function', imports);
      expect(result).toBeUndefined();
    });
  });
  
  describe('expand_namespace_import', () => {
    it('should expand namespace import with module graph', () => {
      const namespace_import: ImportInfo = {
        name: 'utils',
        source: './utils',
        kind: 'namespace',
        namespace_name: 'utils',
        location: { line: 0, column: 0 }
      };
      
      const module_graph: ModuleGraph = {
        modules: new Map([
          ['./utils', {
            path: './utils',
            imports: new Map(),
            exports: new Map([
              ['helper1', {
                name: 'helper1',
                local_name: 'helper1',
                location: { line: 1, column: 0 },
                is_default: false,
                is_namespace: false
              }],
              ['helper2', {
                name: 'helper2',
                local_name: 'helper2',
                location: { line: 2, column: 0 },
                is_default: false,
                is_namespace: false
              }]
            ]),
            imported_by: new Set(),
            language: 'javascript'
          } as ModuleNode]
        ]),
        entry_points: new Set(['./utils'])
      };
      
      const expanded = expand_namespace_import(namespace_import, module_graph);
      expect(expanded).toHaveLength(2);
      expect(expanded[0].name).toBe('utils.helper1');
      expect(expanded[1].name).toBe('utils.helper2');
      expect(expanded[0].namespace_name).toBe('utils');
    });
    
    it('should return original import if module not found', () => {
      const namespace_import: ImportInfo = {
        name: 'utils',
        source: './utils',
        kind: 'namespace',
        namespace_name: 'utils',
        location: { line: 0, column: 0 }
      };
      
      const module_graph: ModuleGraph = {
        modules: new Map(),
        entry_points: new Set()
      };
      
      const expanded = expand_namespace_import(namespace_import, module_graph);
      expect(expanded).toHaveLength(1);
      expect(expanded[0]).toBe(namespace_import);
    });
    
    it('should not expand non-namespace imports', () => {
      const named_import: ImportInfo = {
        name: 'helper',
        source: './utils',
        kind: 'named',
        location: { line: 0, column: 0 }
      };
      
      const module_graph: ModuleGraph = {
        modules: new Map(),
        entry_points: new Set()
      };
      
      const expanded = expand_namespace_import(named_import, module_graph);
      expect(expanded).toHaveLength(1);
      expect(expanded[0]).toBe(named_import);
    });
  });
});