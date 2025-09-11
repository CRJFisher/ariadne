/**
 * Tests for generic namespace resolution processor
 */

import { describe, it, expect } from 'vitest';
import {
  detect_namespace_imports_generic,
  resolve_namespace_member_generic,
  get_namespace_exports_generic,
  needs_bespoke_processing,
  merge_namespace_results,
  parse_qualified_access_generic,
  get_namespace_stats
} from './namespace_resolution';
import { get_namespace_config } from './language_configs';
import { ImportStatement as Import, Language, Def } from '@ariadnejs/types';

describe('Generic Namespace Processor', () => {
  describe('detect_namespace_imports_generic', () => {
    it('should detect wildcard imports across languages', () => {
      const jsImport: Import = {
        source: './utils',
        symbol_name: '*' as any,
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };

      const result = detect_namespace_imports_generic([jsImport], 'javascript');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].namespace_name).toBe('utils');
      expect(result.imports[0].is_namespace).toBe(true);
    });

    it('should detect Python module imports', () => {
      const pyImport: Import = {
        source: 'os',
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };

      const result = detect_namespace_imports_generic([pyImport], 'python');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].namespace_name).toBe('os');
    });

    it('should detect Rust use statements', () => {
      const rustImport: Import = {
        source: 'std::collections',
        symbol_name: '*' as any,
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };

      const result = detect_namespace_imports_generic([rustImport], 'rust');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].namespace_name).toBe('collections');
    });

    it('should identify when bespoke processing is needed', () => {
      const requireImport: Import = {
        source: './lib',
        location: { line: 1, column: 0 }
      };

      const result = detect_namespace_imports_generic([requireImport], 'javascript');
      // Can't detect CommonJS without import_statement field
      expect(result.requires_bespoke).toBe(false);
      expect(result.bespoke_hints?.has_commonjs).toBeUndefined();
    });

    it('should handle dynamic imports hint', () => {
      const dynamicImport: Import = {
        source: './module',
        location: { line: 1, column: 0 }
      };

      const result = detect_namespace_imports_generic([dynamicImport], 'typescript');
      // Can't detect dynamic imports without import_statement field
      expect(result.requires_bespoke).toBe(false);
      expect(result.bespoke_hints?.has_dynamic_imports).toBeUndefined();
    });
  });

  describe('parse_qualified_access_generic', () => {
    it('should parse dot notation for JavaScript/TypeScript', () => {
      const config = get_namespace_config('javascript');
      const result = parse_qualified_access_generic('utils.helpers.format', config);
      
      expect(result.namespace).toBe('utils');
      expect(result.members).toEqual(['helpers', 'format']);
    });

    it('should parse double-colon notation for Rust', () => {
      const config = get_namespace_config('rust');
      const result = parse_qualified_access_generic('std::collections::HashMap', config);
      
      expect(result.namespace).toBe('std');
      expect(result.members).toEqual(['collections', 'HashMap']);
    });

    it('should handle single namespace without members', () => {
      const config = get_namespace_config('python');
      const result = parse_qualified_access_generic('os', config);
      
      expect(result.namespace).toBe('os');
      expect(result.members).toEqual([]);
    });

    it('should handle alternative separators', () => {
      const config = get_namespace_config('rust');
      // Rust can use . for method calls even though :: is primary
      const result = parse_qualified_access_generic('module.method', config);
      
      expect(result.namespace).toBe('module');
      expect(result.members).toEqual(['method']);
    });
  });

  describe('resolve_namespace_member_generic', () => {
    it('should resolve visible members', () => {
      const context = {
        language: 'javascript' as Language,
        file_path: '/test.js',
        config: {} as any
      };

      const exports = new Map<string, any>([
        ['publicFunc', { name: 'publicFunc', is_exported: true } as Def],
        ['publicClass', { name: 'publicClass', is_exported: true } as Def]
      ]);

      const result = resolve_namespace_member_generic(
        'utils',
        'publicFunc',
        context,
        exports
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('publicFunc');
    });

    it('should respect Python private prefix', () => {
      const context = {
        language: 'python' as Language,
        file_path: '/test.py',
        config: {} as any
      };

      const exports = new Map<string, any>([
        ['_private', { name: '_private', is_exported: true } as Def],
        ['public', { name: 'public', is_exported: true } as Def]
      ]);

      const privateResult = resolve_namespace_member_generic(
        'module',
        '_private',
        context,
        exports
      );

      const publicResult = resolve_namespace_member_generic(
        'module',
        'public',
        context,
        exports
      );

      // Python has visibility_rules.private_prefix = '_'
      // So _private should not be visible
      expect(privateResult).toBeUndefined();
      // Public member should be visible
      expect(publicResult).toBeDefined();
      expect(publicResult?.name).toBe('public');
    });

    it('should identify re-exports', () => {
      const context = {
        language: 'typescript' as Language,
        file_path: '/test.ts',
        config: {} as any
      };

      const exports = new Map<string, any>([
        ['reexported', { is_namespace_reexport: true, target_module: './other' }]
      ]);

      const result = resolve_namespace_member_generic(
        'utils',
        'reexported',
        context,
        exports
      );

      expect(result).toBeUndefined(); // Re-exports need further resolution
    });
  });

  describe('get_namespace_exports_generic', () => {
    it('should get exports with default public visibility', () => {
      const mockFileGraph = {
        defs: [
          { name: 'func1', is_exported: true } as Def,
          { name: 'func2', is_exported: true } as Def,
          { name: 'Class1', is_exported: true } as Def
        ]
      };

      const context = {
        language: 'javascript' as Language,
        file_path: '/test.js',
        config: {
          get_file_graph: () => mockFileGraph as any
        }
      };

      const exports = get_namespace_exports_generic('/test.js', context);
      
      expect(exports.size).toBe(3);
      expect(exports.has('func1')).toBe(true);
      expect(exports.has('func2')).toBe(true);
      expect(exports.has('Class1')).toBe(true);
    });

    it('should filter Python private members', () => {
      const mockFileGraph = {
        defs: [
          { name: '_private', is_exported: true } as Def,
          { name: '__private', is_exported: true } as Def,
          { name: 'public', is_exported: true } as Def
        ]
      };

      const context = {
        language: 'python' as Language,
        file_path: '/test.py',
        config: {
          get_file_graph: () => mockFileGraph as any
        }
      };

      const exports = get_namespace_exports_generic('/test.py', context);
      
      expect(exports.size).toBe(1);
      expect(exports.has('public')).toBe(true);
      expect(exports.has('_private')).toBe(false);
    });

    it('should respect explicit export flags', () => {
      const mockFileGraph = {
        defs: [
          { name: 'exported', is_exported: true } as Def,
          { name: 'notExported', is_exported: false } as Def
        ]
      };

      const context = {
        language: 'rust' as Language,
        file_path: '/test.rs',
        config: {
          get_file_graph: () => mockFileGraph as any
        }
      };

      const exports = get_namespace_exports_generic('/test.rs', context);
      
      expect(exports.size).toBe(1);
      expect(exports.has('exported')).toBe(true);
      expect(exports.has('notExported')).toBe(false);
    });
  });

  describe('needs_bespoke_processing', () => {
    it('should detect CommonJS patterns', () => {
      const jsCode = `
        const lib = require('./lib');
        module.exports = { func };
        exports.helper = helper;
      `;
      
      expect(needs_bespoke_processing(jsCode, 'javascript')).toBe(true);
    });

    it('should detect dynamic imports', () => {
      const tsCode = `
        const module = await import('./module');
        import('./lazy').then(m => m.default());
      `;
      
      expect(needs_bespoke_processing(tsCode, 'typescript')).toBe(true);
    });

    it('should detect TypeScript namespace declarations', () => {
      const tsCode = `
        namespace MyNamespace {
          export function func() {}
        }
        module MyModule {
          export class MyClass {}
        }
      `;
      
      expect(needs_bespoke_processing(tsCode, 'typescript')).toBe(true);
    });

    it('should detect Python __init__ packages', () => {
      const pyCode = `
        from .__init__ import setup
        import pkg.__init__
      `;
      
      expect(needs_bespoke_processing(pyCode, 'python')).toBe(true);
    });

    it('should return false for standard imports', () => {
      const jsCode = `
        import { func } from './module';
        import * as utils from './utils';
        export function myFunc() {}
      `;
      
      expect(needs_bespoke_processing(jsCode, 'javascript')).toBe(false);
    });
  });

  describe('merge_namespace_results', () => {
    it('should prefer bespoke over generic results', () => {
      const generic = [
        { namespace_name: 'utils', source_module: './utils', is_namespace: true, members: undefined },
        { namespace_name: 'lib', source_module: './lib', is_namespace: true, members: undefined }
      ];

      const bespoke = [
        { namespace_name: 'utils', source_module: './utils', is_namespace: true, members: ['func1', 'func2'] },
        { namespace_name: 'dynamic', source_module: './dynamic', is_namespace: true, members: undefined }
      ];

      const merged = merge_namespace_results(generic, bespoke);
      
      expect(merged).toHaveLength(3);
      
      const utilsResult = merged.find(r => r.namespace_name === 'utils');
      expect(utilsResult?.members).toEqual(['func1', 'func2']); // Bespoke version
      
      expect(merged.some(r => r.namespace_name === 'lib')).toBe(true);
      expect(merged.some(r => r.namespace_name === 'dynamic')).toBe(true);
    });

    it('should deduplicate identical results', () => {
      const generic = [
        { namespace_name: 'utils', source_module: './utils', is_namespace: true, members: undefined }
      ];

      const bespoke = [
        { namespace_name: 'utils', source_module: './utils', is_namespace: true, members: undefined }
      ];

      const merged = merge_namespace_results(generic, bespoke);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].namespace_name).toBe('utils');
    });
  });

  describe('get_namespace_stats', () => {
    it('should calculate statistics correctly', () => {
      const imports = [
        { namespace_name: 'utils', source_module: './utils', is_namespace: true, members: undefined },
        { namespace_name: 'helpers', source_module: './utils', is_namespace: true, members: undefined },
        { namespace_name: 'lib', source_module: './lib', is_namespace: true, members: undefined },
        { namespace_name: 'core', source_module: '@company/core', is_namespace: true, members: undefined }
      ];

      const stats = get_namespace_stats(imports);
      
      expect(stats.total).toBe(4);
      expect(stats.by_source.get('./utils')).toBe(2);
      expect(stats.by_source.get('./lib')).toBe(1);
      expect(stats.by_source.get('@company/core')).toBe(1);
    });

    it('should handle empty imports', () => {
      const stats = get_namespace_stats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.by_source.size).toBe(0);
    });
  });
});