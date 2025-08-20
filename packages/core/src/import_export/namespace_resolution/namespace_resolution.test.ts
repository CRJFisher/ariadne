/**
 * Tests for namespace resolution
 */

import { describe, it, expect } from 'vitest';
import { Language, ScopeGraph, Def, Import } from '@ariadnejs/types';
import {
  resolve_namespace_exports,
  resolve_namespace_member,
  is_namespace_import,
  get_namespace_members,
  namespace_has_member,
  split_qualified_name,
  analyze_namespace
} from './index';

// Mock scope graph
function create_mock_scope_graph(defs: Def[], imports: Import[] = []): ScopeGraph {
  return {
    getNodes: (type: string) => {
      if (type === 'definition') return defs;
      if (type === 'reference') return [];
      return [];
    },
    getAllImports: () => imports,
  } as any;
}

// Mock config
function create_mock_config(graphs: Map<string, ScopeGraph>) {
  return {
    get_file_graph: (path: string) => graphs.get(path),
    get_imports_with_definitions: (path: string) => {
      const graph = graphs.get(path);
      if (!graph) return [];
      
      return graph.getAllImports().map(imp => ({
        local_name: imp.name,
        import_statement: imp,
        imported_function: {} as Def
      }));
    }
  };
}

describe('namespace_resolution', () => {
  describe('is_namespace_import', () => {
    it('should identify JavaScript namespace imports', () => {
      const imp: Import = {
        name: 'ns',
        source_name: '*',
        source_module: './module'
      };
      
      expect(is_namespace_import(imp, 'javascript')).toBe(true);
    });
    
    it('should identify Python module imports', () => {
      const imp: Import = {
        name: 'module',
        source_module: 'package.module'
      };
      
      expect(is_namespace_import(imp, 'python')).toBe(true);
    });
    
    it('should identify Rust glob imports', () => {
      const imp: Import = {
        name: 'prelude',
        source_name: '*',
        source_module: 'std::prelude'
      };
      
      expect(is_namespace_import(imp, 'rust')).toBe(true);
    });
  });
  
  describe('resolve_namespace_exports', () => {
    it('should resolve JavaScript exports', () => {
      const defs: Def[] = [
        {
          name: 'exportedFunc',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#exportedFunc',
          file_path: 'module.js'
        },
        {
          name: 'privateFunc',
          symbol_kind: 'function',
          is_exported: false,
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
          symbol_id: 'file#privateFunc',
          file_path: 'module.js'
        }
      ];
      
      const graph = create_mock_scope_graph(defs);
      const config = create_mock_config(new Map([['module.js', graph]]));
      
      const context = {
        language: 'javascript' as Language,
        file_path: 'module.js',
        config
      };
      
      const exports = resolve_namespace_exports('module.js', context);
      
      expect(exports.size).toBe(1);
      expect(exports.has('exportedFunc')).toBe(true);
      expect(exports.has('privateFunc')).toBe(false);
    });
    
    it('should resolve Python exports with underscore convention', () => {
      const defs: Def[] = [
        {
          name: 'public_func',
          symbol_kind: 'function',
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#public_func',
          file_path: 'module.py'
        },
        {
          name: '_private_func',
          symbol_kind: 'function',
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
          symbol_id: 'file#_private_func',
          file_path: 'module.py'
        }
      ];
      
      const graph = create_mock_scope_graph(defs);
      const config = create_mock_config(new Map([['module.py', graph]]));
      
      const context = {
        language: 'python' as Language,
        file_path: 'module.py',
        config
      };
      
      const exports = resolve_namespace_exports('module.py', context);
      
      expect(exports.has('public_func')).toBe(true);
      expect(exports.has('_private_func')).toBe(false);
    });
    
    it('should resolve Rust exports with pub keyword', () => {
      const defs: Def[] = [
        {
          name: 'public_fn',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#public_fn',
          file_path: 'module.rs'
        },
        {
          name: 'private_fn',
          symbol_kind: 'function',
          is_exported: false,
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
          symbol_id: 'file#private_fn',
          file_path: 'module.rs'
        }
      ];
      
      const graph = create_mock_scope_graph(defs);
      const config = create_mock_config(new Map([['module.rs', graph]]));
      
      const context = {
        language: 'rust' as Language,
        file_path: 'module.rs',
        config
      };
      
      const exports = resolve_namespace_exports('module.rs', context);
      
      expect(exports.has('public_fn')).toBe(true);
      expect(exports.has('private_fn')).toBe(false);
    });
  });
  
  describe('resolve_namespace_member', () => {
    it('should resolve a namespace member', () => {
      const target_defs: Def[] = [
        {
          name: 'targetFunc',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'target#targetFunc',
          file_path: 'target.js'
        }
      ];
      
      const imports: Import[] = [
        {
          name: 'ns',
          source_name: '*',
          source_module: 'target.js'
        }
      ];
      
      const context_def: Def = {
        name: 'contextFunc',
        symbol_kind: 'function',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
        symbol_id: 'main#contextFunc',
        file_path: 'main.js'
      };
      
      const graphs = new Map([
        ['target.js', create_mock_scope_graph(target_defs)],
        ['main.js', create_mock_scope_graph([], imports)]
      ]);
      
      const config = create_mock_config(graphs);
      
      const context = {
        language: 'javascript' as Language,
        file_path: 'main.js',
        config
      };
      
      const resolved = resolve_namespace_member('ns', 'targetFunc', context_def, context);
      
      expect(resolved).toBeDefined();
      expect(resolved?.name).toBe('targetFunc');
    });
  });
  
  describe('get_namespace_members', () => {
    it('should list all namespace members', () => {
      const target_defs: Def[] = [
        {
          name: 'func1',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'target#func1',
          file_path: 'target.js'
        },
        {
          name: 'func2',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
          symbol_id: 'target#func2',
          file_path: 'target.js'
        }
      ];
      
      const imports: Import[] = [
        {
          name: 'ns',
          source_name: '*',
          source_module: 'target.js'
        }
      ];
      
      const context_def: Def = {
        name: 'contextFunc',
        symbol_kind: 'function',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
        symbol_id: 'main#contextFunc',
        file_path: 'main.js'
      };
      
      const graphs = new Map([
        ['target.js', create_mock_scope_graph(target_defs)],
        ['main.js', create_mock_scope_graph([], imports)]
      ]);
      
      const config = create_mock_config(graphs);
      
      const context = {
        language: 'javascript' as Language,
        file_path: 'main.js',
        config
      };
      
      const members = get_namespace_members('ns', context_def, context);
      
      expect(members).toContain('func1');
      expect(members).toContain('func2');
      expect(members).toHaveLength(2);
    });
  });
  
  describe('split_qualified_name', () => {
    it('should split qualified names correctly', () => {
      const result = split_qualified_name('ns.member');
      expect(result).toEqual({
        namespace: ['ns'],
        member: 'member'
      });
    });
    
    it('should handle nested namespaces', () => {
      const result = split_qualified_name('pkg.module.submodule.func');
      expect(result).toEqual({
        namespace: ['pkg', 'module', 'submodule'],
        member: 'func'
      });
    });
    
    it('should return null for non-qualified names', () => {
      const result = split_qualified_name('simple_name');
      expect(result).toBeNull();
    });
  });
  
  describe('analyze_namespace', () => {
    it('should analyze JavaScript namespaces', () => {
      const context_def: Def = {
        name: 'func',
        symbol_kind: 'function',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
        symbol_id: 'file#func',
        file_path: 'main.js'
      };
      
      const context = {
        language: 'javascript' as Language,
        file_path: 'main.js',
        config: create_mock_config(new Map())
      };
      
      const info = analyze_namespace('ns', context_def, context);
      
      expect(info).toHaveProperty('is_commonjs');
      expect(info).toHaveProperty('is_dynamic_import');
    });
    
    it('should analyze Python namespaces', () => {
      const context_def: Def = {
        name: 'func',
        symbol_kind: 'function',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
        symbol_id: 'file#func',
        file_path: 'main.py'
      };
      
      const context = {
        language: 'python' as Language,
        file_path: 'main.py',
        config: create_mock_config(new Map())
      };
      
      const info = analyze_namespace('module', context_def, context);
      
      expect(info).toHaveProperty('is_package');
      expect(info).toHaveProperty('has_all_attribute');
    });
  });
});