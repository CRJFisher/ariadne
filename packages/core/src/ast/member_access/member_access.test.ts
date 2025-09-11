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
});