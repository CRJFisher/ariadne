/**
 * Tests for import resolution functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolve_import_definition,
  get_imports_with_definitions,
  resolve_namespace_exports,
  resolve_namespace_member,
  resolve_module_file_path,
  get_language_from_file,
  is_namespace_member_access,
  extract_namespace_and_member,
  is_namespace_import,
  is_default_import,
  is_named_import,
  is_index_file,
  ImportResolutionConfig
} from './index';
import { Import, Def, Ref, ScopeGraph } from '@ariadnejs/types';

describe('import_resolution', () => {
  // Mock scope graph
  const create_mock_graph = (defs: Def[], imports: Import[]): ScopeGraph => ({
    getNodes: (type: string) => {
      if (type === 'definition') return defs;
      if (type === 'reference') return [];
      return [];
    },
    getAllImports: () => imports,
    findExportedDef: (name: string) => defs.find(d => d.name === name && d.is_exported),
    // Add other required ScopeGraph methods as needed
  } as ScopeGraph);
  
  // Helper to create test imports
  const create_import = (
    name: string,
    source_module?: string,
    source_name?: string
  ): Import => ({
    id: 1,
    kind: 'import',
    name,
    source_module,
    source_name,
    symbol_id: `test#${name}`,
    symbol_kind: 'import',
    range: {
      start: { row: 1, column: 0 },
      end: { row: 1, column: 10 }
    },
    file_path: 'test.js'
  });
  
  // Helper to create test definitions
  const create_def = (
    name: string,
    file_path: string = 'test.js',
    is_exported: boolean = true
  ): Def => ({
    id: 1,
    kind: 'definition',
    name,
    symbol_id: `${file_path}#${name}`,
    symbol_kind: 'function',
    range: {
      start: { row: 5, column: 0 },
      end: { row: 10, column: 0 }
    },
    file_path,
    is_exported
  });
  
  describe('import type detection', () => {
    it('should identify namespace imports', () => {
      const imp = create_import('utils', './utils', '*');
      expect(is_namespace_import(imp, 'javascript')).toBe(true);
      expect(is_namespace_import(imp, 'typescript')).toBe(true);
      expect(is_namespace_import(imp, 'rust')).toBe(true);
    });
    
    it('should identify default imports', () => {
      const imp = create_import('MyComponent', './component', 'default');
      expect(is_default_import(imp, 'javascript')).toBe(true);
      expect(is_default_import(imp, 'typescript')).toBe(true);
      expect(is_default_import(imp, 'python')).toBe(false);
      expect(is_default_import(imp, 'rust')).toBe(false);
    });
    
    it('should identify named imports', () => {
      const imp = create_import('foo', './module', 'foo');
      expect(is_named_import(imp, 'javascript')).toBe(true);
      expect(is_named_import(imp, 'python')).toBe(true);
    });
  });
  
  describe('resolve_import_definition', () => {
    it('should resolve named import to definition', () => {
      const target_def = create_def('foo', 'utils.js');
      const imp = create_import('foo', './utils', 'foo');
      
      const config: ImportResolutionConfig = {
        get_file_graph: (path) => {
          if (path === './utils.js') {
            return create_mock_graph([target_def], []);
          }
          return undefined;
        },
        resolve_module_path: (from, to) => {
          if (to === './utils') return './utils.js';
          return null;
        }
      };
      
      const result = resolve_import_definition(imp, 'test.js', 'javascript', config);
      expect(result).toEqual(target_def);
    });
    
    it('should create module definition for namespace import', () => {
      const imp = create_import('utils', './utils', '*');
      
      const config: ImportResolutionConfig = {
        get_file_graph: (path) => {
          if (path === './utils.js') {
            return create_mock_graph([], []);
          }
          return undefined;
        },
        resolve_module_path: (from, to) => {
          if (to === './utils') return './utils.js';
          return null;
        }
      };
      
      const result = resolve_import_definition(imp, 'test.js', 'javascript', config);
      expect(result?.symbol_kind).toBe('module');
      expect(result?.name).toBe('utils');
      expect(result?.file_path).toBe('./utils.js');
    });
  });
  
  describe('resolve_namespace_exports', () => {
    it('should get all exported definitions', () => {
      const defs = [
        create_def('foo', 'utils.js', true),
        create_def('bar', 'utils.js', true),
        create_def('_private', 'utils.js', false)
      ];
      
      const config: ImportResolutionConfig = {
        get_file_graph: (path) => {
          if (path === 'utils.js') {
            return create_mock_graph(defs, []);
          }
          return undefined;
        }
      };
      
      const exports = resolve_namespace_exports('utils.js', 'javascript', config);
      expect(exports.size).toBe(2);
      expect(exports.has('foo')).toBe(true);
      expect(exports.has('bar')).toBe(true);
      expect(exports.has('_private')).toBe(false);
    });
    
    it('should detect re-exported namespaces', () => {
      const imports = [
        create_import('external', './external', '*')
      ];
      const defs = [
        create_def('external', 'utils.js', true)
      ];
      
      const config: ImportResolutionConfig = {
        get_file_graph: (path) => {
          if (path === 'utils.js') {
            return create_mock_graph(defs, imports);
          }
          return undefined;
        }
      };
      
      const exports = resolve_namespace_exports('utils.js', 'javascript', config);
      const external_export = exports.get('external');
      
      // Could be either a definition or a re-export marker
      expect(external_export).toBeDefined();
    });
  });
  
  describe('resolve_namespace_member', () => {
    it('should resolve member access on namespace import', () => {
      const namespace_def = create_def('utils', 'test.js');
      namespace_def.symbol_kind = 'module';
      
      const target_def = create_def('formatDate', 'utils.js');
      
      const member_ref: Ref = {
        id: 1,
        kind: 'reference',
        name: 'formatDate',
        symbol_id: 'test#formatDate',
        symbol_kind: 'function',
        range: { start: { row: 10, column: 5 }, end: { row: 10, column: 15 } },
        file_path: 'test.js'
      };
      
      const context_def = create_def('main', 'test.js');
      
      const config: ImportResolutionConfig = {
        get_file_graph: (path) => {
          if (path === 'test.js') {
            const imports = [create_import('utils', './utils', '*')];
            return create_mock_graph([context_def], imports);
          }
          if (path === 'utils.js') {
            return create_mock_graph([target_def], []);
          }
          return undefined;
        },
        resolve_module_path: (from, to) => {
          if (to === './utils') return 'utils.js';
          return null;
        }
      };
      
      // Create namespace import info
      const imports = [
        {
          import_statement: create_import('utils', './utils', '*'),
          imported_function: { ...namespace_def, file_path: 'utils.js' },
          local_name: 'utils'
        }
      ];
      
      // Mock getting imports
      const enhanced_config = {
        ...config,
        get_file_graph: (path: string) => {
          const graph = config.get_file_graph(path);
          if (path === 'test.js' && graph) {
            return {
              ...graph,
              getAllImports: () => imports.map(i => i.import_statement)
            };
          }
          return graph;
        }
      };
      
      const result = resolve_namespace_member(
        'utils',
        member_ref,
        context_def,
        'javascript',
        enhanced_config
      );
      
      expect(result?.name).toBe('formatDate');
    });
  });
  
  describe('language detection', () => {
    it('should detect language from file extension', () => {
      expect(get_language_from_file('test.js')).toBe('javascript');
      expect(get_language_from_file('test.ts')).toBe('typescript');
      expect(get_language_from_file('test.py')).toBe('python');
      expect(get_language_from_file('test.rs')).toBe('rust');
      expect(get_language_from_file('test.jsx')).toBe('javascript');
      expect(get_language_from_file('test.tsx')).toBe('typescript');
      expect(get_language_from_file('test.mjs')).toBe('javascript');
      expect(get_language_from_file('test.unknown')).toBe('javascript'); // default
    });
  });
  
  describe('namespace member access detection', () => {
    it('should detect JavaScript member access', () => {
      const ref: Ref = {
        id: 1,
        kind: 'reference',
        name: 'obj.method',
        symbol_id: 'test#method',
        symbol_kind: 'property',
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
        file_path: 'test.js'
      };
      
      expect(is_namespace_member_access(ref, 'javascript')).toBe(true);
    });
    
    it('should detect Python attribute access', () => {
      const ref: Ref = {
        id: 1,
        kind: 'reference',
        name: 'module.function',
        symbol_id: 'test#function',
        symbol_kind: 'attribute',
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 15 } },
        file_path: 'test.py'
      };
      
      expect(is_namespace_member_access(ref, 'python')).toBe(true);
    });
    
    it('should detect Rust path access', () => {
      const ref: Ref = {
        id: 1,
        kind: 'reference',
        name: 'std::collections::HashMap',
        symbol_id: 'test#HashMap',
        symbol_kind: 'path',
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 25 } },
        file_path: 'test.rs'
      };
      
      expect(is_namespace_member_access(ref, 'rust')).toBe(true);
    });
  });
  
  describe('extract_namespace_and_member', () => {
    it('should extract JavaScript namespace and member', () => {
      const ref: Ref = {
        id: 1,
        kind: 'reference',
        name: 'utils.formatDate',
        symbol_id: 'test#formatDate',
        symbol_kind: 'property',
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 16 } },
        file_path: 'test.js'
      };
      
      const result = extract_namespace_and_member(ref, 'javascript');
      expect(result).toEqual({
        namespace: 'utils',
        member: 'formatDate'
      });
    });
    
    it('should extract nested namespace path', () => {
      const ref: Ref = {
        id: 1,
        kind: 'reference',
        name: 'app.utils.string.format',
        symbol_id: 'test#format',
        symbol_kind: 'property',
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 23 } },
        file_path: 'test.js'
      };
      
      const result = extract_namespace_and_member(ref, 'javascript');
      expect(result).toEqual({
        namespace: 'app.utils.string',
        member: 'format'
      });
    });
    
    it('should extract Rust module path', () => {
      const ref: Ref = {
        id: 1,
        kind: 'reference',
        name: 'std::fs::read_to_string',
        symbol_id: 'test#read_to_string',
        symbol_kind: 'path',
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 23 } },
        file_path: 'test.rs'
      };
      
      const result = extract_namespace_and_member(ref, 'rust');
      expect(result).toEqual({
        namespace: 'std::fs',
        member: 'read_to_string'
      });
    });
    
    it('should return null for non-member access', () => {
      const ref: Ref = {
        id: 1,
        kind: 'reference',
        name: 'simpleFunction',
        symbol_id: 'test#simpleFunction',
        symbol_kind: 'function',
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 14 } },
        file_path: 'test.js'
      };
      
      const result = extract_namespace_and_member(ref, 'javascript');
      expect(result).toBeNull();
    });
  });
  
  describe('index file detection', () => {
    it('should detect JavaScript index files', () => {
      expect(is_index_file('src/utils/index.js', 'javascript')).toBe(true);
      expect(is_index_file('src/utils/index.ts', 'typescript')).toBe(true);
      expect(is_index_file('src/utils/index.jsx', 'javascript')).toBe(true);
      expect(is_index_file('src/utils/helper.js', 'javascript')).toBe(false);
    });
    
    it('should detect Python __init__ files', () => {
      expect(is_index_file('mypackage/__init__.py', 'python')).toBe(true);
      expect(is_index_file('mypackage/module.py', 'python')).toBe(false);
    });
    
    it('should detect Rust mod files', () => {
      expect(is_index_file('src/utils/mod.rs', 'rust')).toBe(true);
      expect(is_index_file('src/lib.rs', 'rust')).toBe(true);
      expect(is_index_file('src/main.rs', 'rust')).toBe(false);
    });
  });
});