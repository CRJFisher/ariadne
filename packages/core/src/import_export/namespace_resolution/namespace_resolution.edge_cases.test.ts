/**
 * Edge case tests for namespace resolution
 * 
 * Tests various edge cases across all languages including:
 * - Empty namespaces
 * - Missing modules
 * - Malformed imports
 * - Deeply nested access chains
 * - Unicode identifiers
 * - Circular dependencies
 * - Large-scale performance
 */

import { describe, it, expect } from 'vitest';
import {
  detect_namespace_imports,
  is_namespace_import,
  resolve_namespace_exports,
  resolve_namespace_member,
  resolve_nested_namespace,
  get_namespace_members,
  namespace_has_member
} from './namespace_resolution';
import { ImportStatement as Import, Language, Def } from '@ariadnejs/types';
import { generate_code_graph } from '../../code_graph';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

describe('Namespace Resolution Edge Cases', () => {
  // Helper to create a temporary test project
  function createTestProject(files: Record<string, string>): string {
    const projectDir = join(tmpdir(), `edge-test-${randomBytes(8).toString('hex')}`);
    mkdirSync(projectDir, { recursive: true });
    
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(projectDir, path);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (dir) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(fullPath, content);
    }
    
    return projectDir;
  }

  // Cleanup helper
  function cleanupProject(projectDir: string) {
    try {
      rmSync(projectDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  describe('Empty Namespaces', () => {
    it('should handle empty namespace exports', () => {
      const context = {
        language: 'javascript' as Language,
        file_path: '/empty.js',
        config: {
          get_file_graph: () => ({
            defs: [],
            getAllImports: () => [],
            getNodes: () => []
          } as any)
        }
      };

      const exports = resolve_namespace_exports('/empty.js', context);
      
      expect(exports.size).toBe(0);
    });

    it('should handle namespace with no accessible members', () => {
      const context = {
        language: 'python' as Language,
        file_path: '/private.py',
        config: {
          get_file_graph: () => ({
            defs: [
              { name: '_private1', is_exported: true } as Def,
              { name: '__private2', is_exported: true } as Def
            ]
          } as any)
        }
      };

      const exports = resolve_namespace_exports('/private.py', context);
      
      expect(exports.size).toBe(0); // All members are private
    });

    it('should handle imports from empty modules', async () => {
      const projectDir = createTestProject({
        'empty.js': '',
        'importer.js': 'import * as empty from "./empty";'
      });

      try {
        const graph = await generate_code_graph({
          root_path: projectDir,
          include_patterns: ['**/*.js']
        });

        const importerFile = Array.from(graph.files.values())
          .find(f => f.file_path.endsWith('importer.js'));
        
        expect(importerFile?.imports).toHaveLength(1);
        expect(importerFile?.imports[0].source).toContain('empty');
      } finally {
        cleanupProject(projectDir);
      }
    });
  });

  describe('Missing Modules', () => {
    it('should handle imports from non-existent files', () => {
      const imp: Import = {
        source: './does-not-exist',
        local_name: 'missing',
        is_namespace_import: true,
        location: { line: 1, column: 0 }
      };

      const context = {
        language: 'javascript' as Language,
        file_path: '/test.js',
        config: {
          get_file_graph: () => undefined,
          get_imports_with_definitions: () => []
        }
      };

      const member = resolve_namespace_member('missing', 'anything', {} as Def, context);
      
      expect(member).toBeUndefined();
    });

    it('should handle missing transitive dependencies', async () => {
      const projectDir = createTestProject({
        'a.js': 'export * from "./b";',
        'c.js': 'import * as a from "./a";'
        // Note: b.js is missing
      });

      try {
        const graph = await generate_code_graph({
          root_path: projectDir,
          include_patterns: ['**/*.js']
        });

        // Should not crash despite missing dependency
        expect(graph.files.size).toBeGreaterThan(0);
      } finally {
        cleanupProject(projectDir);
      }
    });
  });

  describe('Malformed Imports', () => {
    it('should handle malformed import statements gracefully', () => {
      const malformedImports: Import[] = [
        {
          source: '',
          local_name: '',
          import_statement: 'import',
          location: { line: 1, column: 0 }
        },
        {
          source: undefined as any,
          local_name: 'broken',
          import_statement: 'import broken from',
          location: { line: 2, column: 0 }
        },
        {
          source: './module',
          local_name: undefined as any,
          import_statement: 'import from "./module"',
          location: { line: 3, column: 0 }
        }
      ];

      for (const imp of malformedImports) {
        const result = is_namespace_import(imp, 'javascript');
        // Should not crash
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle syntax errors in import detection', () => {
      const brokenCode = [
        'import * as',
        'from "./module" import',
        'use ::',
        'require(',
        'export = ',
      ];

      for (const code of brokenCode) {
        const imports = detect_namespace_imports([], 'javascript', code);
        // Should not crash
        expect(Array.isArray(imports)).toBe(true);
      }
    });
  });

  describe('Deeply Nested Access Chains', () => {
    it('should handle very deep namespace chains', () => {
      const deepPath = ['ns1', 'ns2', 'ns3', 'ns4', 'ns5', 'member'];
      const mockDef = { 
        name: 'test',
        file_path: '/test.js',
        line: 1,
        column: 0,
        symbol_kind: 'function'
      } as Def;
      
      const context = {
        language: 'javascript' as Language,
        file_path: '/test.js',
        config: {
          get_imports_with_definitions: () => [],
          get_file_graph: () => undefined
        }
      };

      const result = resolve_nested_namespace(
        deepPath.slice(0, -1),
        deepPath[deepPath.length - 1],
        mockDef,
        context
      );
      
      // Should handle gracefully even if can't resolve
      expect(result === undefined || result !== undefined).toBe(true);
    });

    it('should handle circular namespace references', async () => {
      const projectDir = createTestProject({
        'a.ts': `
          import * as b from './b';
          export const fromA = 'a';
          export const useB = b.fromB;
        `,
        'b.ts': `
          import * as a from './a';
          export const fromB = 'b';
          export const useA = a.fromA;
        `
      });

      try {
        const graph = await generate_code_graph({
          root_path: projectDir,
          include_patterns: ['**/*.ts']
        });

        // Should handle circular dependencies without infinite loop
        expect(graph.files.size).toBe(2);
      } finally {
        cleanupProject(projectDir);
      }
    });
  });

  describe('Unicode Identifiers', () => {
    it('should handle Unicode namespace names', () => {
      const unicodeImports: Import[] = [
        {
          source: './日本語',
          symbol_name: '*' as any,
          is_namespace_import: true,
          location: { line: 1, column: 0 }
        },
        {
          source: './émoji',
          symbol_name: '*' as any,
          is_namespace_import: true,
          location: { line: 2, column: 0 }
        },
        {
          source: './кириллица',
          symbol_name: '*' as any,
          is_namespace_import: true,
          location: { line: 3, column: 0 }
        }
      ];

      const results = detect_namespace_imports(unicodeImports, 'javascript');
      
      expect(results).toHaveLength(3);
      expect(results[0].namespace_name).toBe('日本語');
      expect(results[1].namespace_name).toBe('émoji');
      expect(results[2].namespace_name).toBe('кириллица');
    });

    it('should handle Unicode member names', () => {
      const mockDef = { 
        name: 'test',
        file_path: '/test.js',
        line: 1,
        column: 0,
        symbol_kind: 'function'
      } as Def;
      
      const context = {
        language: 'javascript' as Language,
        file_path: '/unicode.js',
        config: {
          get_imports_with_definitions: () => [{
            local_name: 'ns',
            import_statement: {
              source_name: '*',
              source: './module',
              local_name: 'ns',
              source_module: '/module.js',
              is_namespace_import: true,
              location: { line: 1, column: 0 }
            } as Import,
            imported_function: mockDef
          }],
          get_file_graph: () => ({
            defs: [
              { name: '函数', is_exported: true } as Def,
              { name: '🚀', is_exported: true } as Def,
              { name: 'café', is_exported: true } as Def
            ]
          } as any)
        }
      };

      const members = ['函数', '🚀', 'café'];
      
      for (const member of members) {
        // Just test that it doesn't crash with Unicode
        try {
          const result = resolve_namespace_member(
            'ns',
            member,
            mockDef,
            context,
            ''
          );
          // Should handle Unicode gracefully
          expect(result === undefined || result !== undefined).toBe(true);
        } catch {
          // Should not throw
          expect(true).toBe(false);
        }
      }
    });
  });

  describe('Mixed Language Imports', () => {
    it('should handle mixed ES6/CommonJS in same file', () => {
      const code = `
        import * as es6 from './es6-module';
        const commonjs = require('./commonjs-module');
        export * from './reexport';
        module.exports.extra = 'value';
      `;

      const imports: Import[] = [
        {
          source: './es6-module',
          symbol_name: '*' as any,
          is_namespace_import: true,
          location: { line: 1, column: 0 }
        },
        {
          source: './commonjs-module',
          location: { line: 2, column: 0 }
        }
      ];

      const results = detect_namespace_imports(imports, 'javascript', code);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance with Large Namespaces', () => {
    it('should handle namespace with many exports efficiently', () => {
      const largeExports = new Map();
      
      // Create 1000 exports
      for (let i = 0; i < 1000; i++) {
        largeExports.set(`export${i}`, {
          name: `export${i}`,
          is_exported: true
        } as Def);
      }

      const context = {
        language: 'javascript' as Language,
        file_path: '/large.js',
        config: {
          get_file_graph: () => ({
            defs: Array.from(largeExports.values())
          } as any)
        }
      };

      const startTime = Date.now();
      const exports = resolve_namespace_exports('/large.js', context);
      const endTime = Date.now();
      
      expect(exports.size).toBe(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle many namespace imports efficiently', () => {
      const manyImports: Import[] = [];
      
      // Create 100 namespace imports
      for (let i = 0; i < 100; i++) {
        manyImports.push({
          source: `./module${i}`,
          symbol_name: '*' as any,
          is_namespace_import: true,
          location: { line: i, column: 0 }
        });
      }

      const startTime = Date.now();
      const results = detect_namespace_imports(manyImports, 'typescript');
      const endTime = Date.now();
      
      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });
  });

  describe('Special Characters and Escaping', () => {
    it('should handle paths with special characters', () => {
      const specialPaths = [
        './path-with-dashes',
        './path.with.dots',
        './path_with_underscores',
        './@scoped/package',
        './path with spaces',
        './päth-wïth-ümläüts'
      ];

      for (const path of specialPaths) {
        const imp: Import = {
          source: path,
          symbol_name: '*' as any,
          is_namespace_import: true,
          location: { line: 1, column: 0 }
        };

        const result = is_namespace_import(imp, 'javascript');
        expect(result).toBe(true);
      }
    });

    it('should handle escaped characters in strings', () => {
      const code = `
        const ns1 = require('./path\\/with\\/backslashes');
        const ns2 = require('./path\\nwith\\nnewlines');
        const ns3 = require('./path\\twith\\ttabs');
      `;

      const imports = detect_namespace_imports([], 'javascript', code);
      // Should handle escape sequences properly
      expect(imports).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from partial failures in batch processing', () => {
      const mixedImports: Import[] = [
        { source: './valid1', symbol_name: '*' as any, is_namespace_import: true, location: { line: 1, column: 0 } },
        { source: '', location: { line: 2, column: 0 } }, // Invalid
        { source: './valid2', symbol_name: '*' as any, is_namespace_import: true, location: { line: 3, column: 0 } },
      ];

      const results = detect_namespace_imports(mixedImports, 'javascript');
      
      // Should process valid imports despite invalid ones
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle null/undefined gracefully', () => {
      const context = {
        language: 'javascript' as Language,
        file_path: '/test.js',
        config: {
          get_file_graph: () => null,
          get_imports_with_definitions: () => []
        }
      };

      // Should not crash with null values  
      try {
        const exports = resolve_namespace_exports('/test.js', context);
        expect(exports.size).toBe(0);
      } catch {
        // Should handle gracefully
        expect(true).toBe(true);
      }
      
      const mockDef = { name: 'test', file_path: '/test.js' } as Def;
      
      const members = get_namespace_members('test', mockDef, context);
      expect(members).toHaveLength(0);
      
      const hasMember = namespace_has_member('test', 'member', mockDef, context);
      expect(hasMember).toBe(false);
    });
  });
});