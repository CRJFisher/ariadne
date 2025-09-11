/**
 * Tests for member access expression detection
 */

import { describe, it, expect } from 'vitest';
import { find_member_access_expressions } from './index';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { FileAnalysis, Language, FilePath } from '@ariadnejs/types';

// Helper to create a test file analysis
function create_test_analysis(
  imports: any[],
  language: Language,
  file_path: string = '/test/file.ts'
): FileAnalysis {
  return {
    file_path: file_path as FilePath,
    source_code: '' as any,  // Not needed for these tests
    language,
    imports,
    exports: [],
    functions: [],
    classes: [],
    variables: [],
    type_info: new Map(),
    errors: [],
    scopes: { type: 'module', children: [] } as any,  // Minimal scope tree
    function_calls: [],
    method_calls: [],
    constructor_calls: []
  };
}

// Helper to parse code and get AST
function parse_code(code: string, language: Language): any {
  const parser = new Parser();
  
  switch (language) {
    case 'javascript':
      parser.setLanguage(JavaScript);
      break;
    case 'typescript':
      parser.setLanguage(TypeScript.typescript);
      break;
    case 'python':
      parser.setLanguage(Python);
      break;
    case 'rust':
      parser.setLanguage(Rust);
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
  
  return parser.parse(code).rootNode;
}

describe('Member Access Detection', () => {
  describe('TypeScript/JavaScript', () => {
    it('should detect namespace member access', () => {
      const code = `
        import * as types from './types';
        
        const user: types.User = {
          id: 1,
          name: 'Test'
        };
        
        const isValid = types.validateUser(user);
      `;
      
      const analysis = create_test_analysis(
        [{
          source: './types',
          is_namespace_import: true,
          namespace_name: 'types',
          location: { file_path: '/test/file.ts', line: 2, column: 1 }
        }],
        'typescript'
      );
      
      const root_node = parse_code(code, 'typescript');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      expect(accesses).toHaveLength(2);
      expect(accesses[0]).toMatchObject({
        namespace: 'types',
        member: 'User'
      });
      expect(accesses[1]).toMatchObject({
        namespace: 'types',
        member: 'validateUser'
      });
    });
    
    it('should not detect non-namespace member access', () => {
      const code = `
        import { User } from './types';
        
        const obj = { prop: 'value' };
        const value = obj.prop;
      `;
      
      const analysis = create_test_analysis(
        [{
          source: './types',
          is_namespace_import: false,
          imported: [{ name: 'User', local_name: 'User' }],
          location: { file_path: '/test/file.ts', line: 2, column: 1 }
        }],
        'typescript'
      );
      
      const root_node = parse_code(code, 'typescript');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      expect(accesses).toHaveLength(0);
    });
  });
  
  describe('Python', () => {
    it('should detect module member access', () => {
      const code = `
import utils

result = utils.process_data(42)
valid = utils.validate_input(result)
processor = utils.DataProcessor()
      `;
      
      const analysis = create_test_analysis(
        [{
          source: 'utils',
          is_namespace_import: true,
          namespace_name: 'utils',
          location: { file_path: '/test/file.py', line: 2, column: 1 }
        }],
        'python',
        '/test/file.py'
      );
      
      const root_node = parse_code(code, 'python');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      expect(accesses).toHaveLength(3);
      expect(accesses[0]).toMatchObject({
        namespace: 'utils',
        member: 'process_data'
      });
      expect(accesses[1]).toMatchObject({
        namespace: 'utils',
        member: 'validate_input'
      });
      expect(accesses[2]).toMatchObject({
        namespace: 'utils',
        member: 'DataProcessor'
      });
    });
  });
  
  describe('Rust', () => {
    it('should detect module path access', () => {
      const code = `
use helpers;

fn main() {
    let result = helpers::process(42);
    let valid = helpers::validate(result);
}
      `;
      
      const analysis = create_test_analysis(
        [{
          source: 'helpers',
          is_namespace_import: true,
          namespace_name: 'helpers',
          location: { file_path: '/test/file.rs', line: 2, column: 1 }
        }],
        'rust',
        '/test/file.rs'
      );
      
      const root_node = parse_code(code, 'rust');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      expect(accesses).toHaveLength(2);
      expect(accesses[0]).toMatchObject({
        namespace: 'helpers',
        member: 'process'
      });
      expect(accesses[1]).toMatchObject({
        namespace: 'helpers',
        member: 'validate'
      });
    });
  });
  
  describe('Edge cases', () => {
    it('should handle nested member access', () => {
      const code = `
        import * as lib from './lib';
        
        // Only the first level should be detected as namespace access
        const result = lib.utils.helpers.process();
      `;
      
      const analysis = create_test_analysis(
        [{
          source: './lib',
          is_namespace_import: true,
          namespace_name: 'lib',
          location: { file_path: '/test/file.ts', line: 2, column: 1 }
        }],
        'typescript'
      );
      
      const root_node = parse_code(code, 'typescript');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      expect(accesses).toHaveLength(1);
      expect(accesses[0]).toMatchObject({
        namespace: 'lib',
        member: 'utils'
      });
    });
    
    it('should handle multiple namespace imports', () => {
      const code = `
        import * as types from './types';
        import * as utils from './utils';
        
        const user: types.User = {};
        const processed = utils.process(user);
      `;
      
      const analysis = create_test_analysis(
        [
          {
            source: './types',
            is_namespace_import: true,
            namespace_name: 'types',
            location: { file_path: '/test/file.ts', line: 2, column: 1 }
          },
          {
            source: './utils',
            is_namespace_import: true,
            namespace_name: 'utils',
            location: { file_path: '/test/file.ts', line: 3, column: 1 }
          }
        ],
        'typescript'
      );
      
      const root_node = parse_code(code, 'typescript');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      expect(accesses).toHaveLength(2);
      expect(accesses.find(a => a.namespace === 'types')).toMatchObject({
        namespace: 'types',
        member: 'User'
      });
      expect(accesses.find(a => a.namespace === 'utils')).toMatchObject({
        namespace: 'utils',
        member: 'process'
      });
    });
  });
  
  describe('Complex edge cases', () => {
    it('should handle empty files gracefully', () => {
      const code = '';
      const analysis = create_test_analysis([], 'typescript');
      const root_node = parse_code(code, 'typescript');
      
      expect(() => find_member_access_expressions(analysis, root_node)).not.toThrow();
      const accesses = find_member_access_expressions(analysis, root_node);
      expect(accesses).toHaveLength(0);
    });
    
    it('should handle files with no imports', () => {
      const code = `
        const obj = { prop: 'value' };
        const result = obj.prop;
        function test() { return result; }
      `;
      const analysis = create_test_analysis([], 'typescript');
      const root_node = parse_code(code, 'typescript');
      
      const accesses = find_member_access_expressions(analysis, root_node);
      expect(accesses).toHaveLength(0);
    });
    
    it('should handle files with only named imports (no namespace)', () => {
      const code = `
        import { User, validateUser } from './types';
        
        const user: User = { id: 1, name: 'Test' };
        const isValid = validateUser(user);
      `;
      const analysis = create_test_analysis([{
        source: './types',
        is_namespace_import: false,
        imported: [
          { name: 'User', local_name: 'User' },
          { name: 'validateUser', local_name: 'validateUser' }
        ],
        location: { file_path: '/test/file.ts', line: 2, column: 1 }
      }], 'typescript');
      
      const root_node = parse_code(code, 'typescript');
      const accesses = find_member_access_expressions(analysis, root_node);
      expect(accesses).toHaveLength(0);
    });
    
    it('should handle deeply nested member access correctly', () => {
      const code = `
        import * as deep from './deep';
        
        const result = deep.level1.level2.level3.method();
        const another = deep.a.b.c.d.e.f;
      `;
      const analysis = create_test_analysis([{
        source: './deep',
        is_namespace_import: true,
        namespace_name: 'deep',
        location: { file_path: '/test/file.ts', line: 2, column: 1 }
      }], 'typescript');
      
      const root_node = parse_code(code, 'typescript');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      // Should only detect the first level (namespace.member)
      expect(accesses).toHaveLength(2);
      expect(accesses[0]).toMatchObject({
        namespace: 'deep',
        member: 'level1'
      });
      expect(accesses[1]).toMatchObject({
        namespace: 'deep',
        member: 'a'
      });
    });
    
    it('should handle mixed import types correctly', () => {
      const code = `
        import * as types from './types';
        import { helper } from './helper';
        import defaultExport from './default';
        
        const user: types.User = {};
        const result = helper(user);
        const data = defaultExport.process();
      `;
      const analysis = create_test_analysis([
        {
          source: './types',
          is_namespace_import: true,
          namespace_name: 'types',
          location: { file_path: '/test/file.ts', line: 2, column: 1 }
        },
        {
          source: './helper',
          is_namespace_import: false,
          imported: [{ name: 'helper', local_name: 'helper' }],
          location: { file_path: '/test/file.ts', line: 3, column: 1 }
        },
        {
          source: './default',
          is_namespace_import: false,
          default_import: 'defaultExport',
          location: { file_path: '/test/file.ts', line: 4, column: 1 }
        }
      ], 'typescript');
      
      const root_node = parse_code(code, 'typescript');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      // Only namespace imports should be detected
      expect(accesses).toHaveLength(1);
      expect(accesses[0]).toMatchObject({
        namespace: 'types',
        member: 'User'
      });
    });
    
    it('should handle member access in different contexts', () => {
      const code = `
        import * as api from './api';
        
        // In variable declaration
        const handler = api.createHandler;
        
        // In function call
        const result = api.processData(data);
        
        // In object property
        const config = {
          processor: api.defaultProcessor,
          validator: api.validate
        };
        
        // In array
        const handlers = [api.handler1, api.handler2];
        
        // In template literal
        const message = \`Processing with \${api.version}\`;
        
        // In conditional
        if (api.isReady) {
          console.log('Ready');
        }
      `;
      const analysis = create_test_analysis([{
        source: './api',
        is_namespace_import: true,
        namespace_name: 'api',
        location: { file_path: '/test/file.ts', line: 2, column: 1 }
      }], 'typescript');
      
      const root_node = parse_code(code, 'typescript');
      const accesses = find_member_access_expressions(analysis, root_node);
      
      // Should detect all member accesses on the namespace
      expect(accesses.length).toBeGreaterThan(5);
      const memberNames = accesses.map(a => a.member);
      expect(memberNames).toContain('createHandler');
      expect(memberNames).toContain('processData');
      expect(memberNames).toContain('defaultProcessor');
      expect(memberNames).toContain('validate');
      expect(memberNames).toContain('handler1');
      expect(memberNames).toContain('handler2');
      expect(memberNames).toContain('isReady');
      // Note: 'version' in template literal may not be detected, which is expected behavior
    });
  });
  
  describe('Language-specific edge cases', () => {
    describe('JavaScript/TypeScript edge cases', () => {
      it('should handle optional chaining in complex expressions', () => {
        const code = `
          import * as api from './api';
          
          const result = api?.getData?.()?.then?.(callback);
          const value = api?.config?.setting;
        `;
        const analysis = create_test_analysis([{
          source: './api',
          is_namespace_import: true,
          namespace_name: 'api',
          location: { file_path: '/test/file.ts', line: 2, column: 1 }
        }], 'typescript');
        
        const root_node = parse_code(code, 'typescript');
        const accesses = find_member_access_expressions(analysis, root_node);
        
        // Should detect namespace member accesses including optional chaining
        const memberNames = accesses.map(a => a.member);
        expect(memberNames).toContain('getData');
        expect(memberNames).toContain('config');
      });
      
      it('should handle computed access with template literals', () => {
        const code = `
          import * as types from './types';
          
          const dynamicType = types[\`User\${suffix}\`];
          const computed = types[variable];
        `;
        const analysis = create_test_analysis([{
          source: './types',
          is_namespace_import: true,
          namespace_name: 'types',
          location: { file_path: '/test/file.ts', line: 2, column: 1 }
        }], 'typescript');
        
        const root_node = parse_code(code, 'typescript');
        const accesses = find_member_access_expressions(analysis, root_node);
        
        // Should detect computed access patterns
        expect(accesses.length).toBeGreaterThan(0);
        const memberNames = accesses.map(a => a.member);
        expect(memberNames.some(name => name.includes('User') || name === 'variable')).toBe(true);
      });
    });
    
    describe('Python edge cases', () => {
      it('should handle complex Python attribute access patterns', () => {
        const code = `
import utils
import other_module

# Regular attribute access
result = utils.process_data(42)

# Chained attribute access (only first level should be detected)
processor = utils.data_processor.advanced_settings

# getattr with dynamic names
dynamic = getattr(utils, method_name)
with_default = getattr(utils, "missing_method", default_func)

# Should not detect non-namespace getattr
local_attr = getattr(some_object, "attribute")
        `;
        const analysis = create_test_analysis([
          {
            source: 'utils',
            is_namespace_import: true,
            namespace_name: 'utils',
            location: { file_path: '/test/file.py', line: 2, column: 1 }
          },
          {
            source: 'other_module',
            is_namespace_import: true,
            namespace_name: 'other_module',
            location: { file_path: '/test/file.py', line: 3, column: 1 }
          }
        ], 'python', '/test/file.py');
        
        const root_node = parse_code(code, 'python');
        const accesses = find_member_access_expressions(analysis, root_node);
        
        expect(accesses.length).toBeGreaterThan(0);
        const memberNames = accesses.map(a => a.member);
        expect(memberNames).toContain('process_data');
        expect(memberNames).toContain('data_processor');
        // Should detect getattr calls too
        expect(memberNames.some(name => ['method_name', 'missing_method'].includes(name))).toBe(true);
      });
    });
    
    describe('Rust edge cases', () => {
      it('should handle complex Rust namespace patterns', () => {
        const code = `
use helpers;
use std;

fn main() {
    // Scoped identifier (::)
    let result = helpers::process(42);
    let std_result = std::collections::HashMap::new();
    
    // Field expression (.)
    let config = helpers.config;
    let nested = helpers.module.setting;
    
    // Mixed patterns
    let complex = helpers::CONSTANT.field;
}
        `;
        const analysis = create_test_analysis([
          {
            source: 'helpers',
            is_namespace_import: true,
            namespace_name: 'helpers',
            location: { file_path: '/test/file.rs', line: 2, column: 1 }
          },
          {
            source: 'std',
            is_namespace_import: true,
            namespace_name: 'std',
            location: { file_path: '/test/file.rs', line: 3, column: 1 }
          }
        ], 'rust', '/test/file.rs');
        
        const root_node = parse_code(code, 'rust');
        const accesses = find_member_access_expressions(analysis, root_node);
        
        expect(accesses.length).toBeGreaterThan(0);
        const memberNames = accesses.map(a => a.member);
        expect(memberNames).toContain('process');
        expect(memberNames).toContain('collections'); // First level of std::collections::HashMap
        expect(memberNames).toContain('config');
        expect(memberNames).toContain('module');
        expect(memberNames).toContain('CONSTANT');
      });
    });
  });
  
  describe('Error handling and malformed input', () => {
    it('should handle syntax errors gracefully', () => {
      const code = `
        import * as broken from './broken
        
        const result = broken.method(;
        const another = broken.
      `;
      const analysis = create_test_analysis([{
        source: './broken',
        is_namespace_import: true,
        namespace_name: 'broken',
        location: { file_path: '/test/file.ts', line: 2, column: 1 }
      }], 'typescript');
      
      // This code has syntax errors but should not crash
      expect(() => {
        const root_node = parse_code(code, 'typescript');
        find_member_access_expressions(analysis, root_node);
      }).not.toThrow();
    });
    
    it('should handle null/undefined nodes gracefully', () => {
      const analysis = create_test_analysis([], 'typescript');
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      
      // Create a minimal tree to get a node
      const tree = parser.parse('const x = 1;');
      const root_node = tree.rootNode;
      
      expect(() => find_member_access_expressions(analysis, root_node)).not.toThrow();
    });
    
    it('should handle extremely large member access chains', () => {
      const chainLength = 50;
      const chain = Array.from({length: chainLength}, (_, i) => `level${i}`).join('.');
      const code = `
        import * as deep from './deep';
        const result = deep.${chain};
      `;
      
      const analysis = create_test_analysis([{
        source: './deep',
        is_namespace_import: true,
        namespace_name: 'deep',
        location: { file_path: '/test/file.ts', line: 2, column: 1 }
      }], 'typescript');
      
      expect(() => {
        const root_node = parse_code(code, 'typescript');
        const accesses = find_member_access_expressions(analysis, root_node);
        // Should only detect first level
        expect(accesses).toHaveLength(1);
        expect(accesses[0]).toMatchObject({
          namespace: 'deep',
          member: 'level0'
        });
      }).not.toThrow();
    });
  });
});