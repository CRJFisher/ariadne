/**
 * Tests for call chain analysis functionality
 */

import { describe, it, expect } from 'vitest';
import {
  build_call_chains,
  detect_recursion,
  find_paths_between,
  get_longest_chain,
  get_recursive_functions,
  CallChainContext
} from './call_chain_analysis';
import { FunctionCall, MethodCall, ConstructorCall, CallChain, FilePath, SymbolId, CallerName, ClassName, ResolvedTypeKind, MODULE_CONTEXT } from '@ariadnejs/types';

describe('call_chain_analysis', () => {

  describe('build_call_chains', () => {
    it('should build simple linear chain', () => {
      const calls: FunctionCall[] = [
        {
          kind: 'function',
          caller: 'main' as CallerName,
          callee: 'foo' as SymbolId,
          location: { file_path: 'test.js' as FilePath, line: 1, column: 0, end_line: 1, end_column: 10 },
          language: 'javascript',
          node_type: 'call_expression',
          is_async: false,
          is_dynamic: false,
          is_macro_call: false,
          is_in_comprehension: false,
          arguments_count: 0,
          modifiers: []
        },
        {
          kind: 'function',
          caller: 'foo' as CallerName,
          callee: 'bar' as SymbolId,
          location: { file_path: 'test.js' as FilePath, line: 5, column: 0, end_line: 5, end_column: 10 },
          language: 'javascript',
          node_type: 'call_expression',
          is_async: false,
          is_dynamic: false,
          is_macro_call: false,
          is_in_comprehension: false,
          arguments_count: 0,
          modifiers: []
        }
      ];

      const context: CallChainContext = {
        language: 'javascript',
        max_depth: 10,
        track_recursion: true
      };

      const result = build_call_chains(calls, context);
      
      expect(result.chains.length).toBeGreaterThan(0);
      expect(result.chains[0]).toBeDefined();
      expect(result.chains[0].nodes.length).toBeGreaterThan(0);
    });

    it('should detect recursive chains', () => {
      const calls: FunctionCall[] = [
        {
          kind: 'function',
          caller: 'factorial' as CallerName,
          callee: 'factorial' as SymbolId,
          location: { file_path: 'test.js' as FilePath, line: 3, column: 0, end_line: 3, end_column: 10 },
          language: 'javascript',
          node_type: 'call_expression',
          is_async: false,
          is_dynamic: false,
          is_macro_call: false,
          is_in_comprehension: false,
          arguments_count: 1,
          modifiers: []
        }
      ];

      const context: CallChainContext = {
        language: 'javascript',
        max_depth: 10,
        track_recursion: true
      };

      const result = build_call_chains(calls, context);
      
      // Use detect_recursion function to find recursive chains
      const recursive_chains = detect_recursion(result.chains);
      expect(recursive_chains.length).toBeGreaterThan(0);
      expect(recursive_chains[0].has_recursion).toBe(true);
      expect(recursive_chains[0].entry_point).toBe('factorial' as SymbolId);
    });

    it('should handle method calls', () => {
      const calls: MethodCall[] = [
        {
          kind: 'method',
          caller: 'main' as CallerName,
          method_name: 'process' as SymbolId,
          receiver: 'obj' as SymbolId,
          location: { file_path: 'test.js' as FilePath, line: 2, column: 0, end_line: 2, end_column: 10 },
          language: 'javascript',
          node_type: 'member_expression',
          is_static: false,
          is_chained: false,
          is_async: false,
          is_dynamic: false,
          arguments_count: 0,
          modifiers: [],
          receiver_type: {
            resolved: {
              type_name: "unknown" as ClassName,
              type_kind: "unknown" as ResolvedTypeKind
            },
            confidence: "low",
            reason: "not_found"
          }
        }
      ];

      const context: CallChainContext = {
        language: 'javascript',
        max_depth: 10
      };

      const result = build_call_chains(calls, context);
      
      expect(result.chains.length).toBeGreaterThan(0);
      expect(result.chains[0]).toBeDefined();
    });

    it('should handle constructor calls', () => {
      const calls: ConstructorCall[] = [
        {
          kind: 'constructor',
          caller: 'main' as CallerName,
          class_name: 'MyClass' as ClassName,
          location: { file_path: 'test.js' as FilePath, line: 1, column: 0, end_line: 1, end_column: 10 },
          language: 'javascript',
          node_type: 'new_expression',
          arguments_count: 0,
          assigned_to: 'instance' as SymbolId,
          is_new_expression: true,
          is_factory: false,
          is_async: false,
          is_dynamic: false,
          modifiers: []
        }
      ];

      const context: CallChainContext = {
        language: 'javascript'
      };

      const result = build_call_chains(calls, context);
      
      expect(result.chains.length).toBeGreaterThan(0);
      expect(result.chains[0]).toBeDefined();
    });

    it('should respect max_depth', () => {
      const calls: FunctionCall[] = [
        {
          kind: 'function',
          caller: 'a' as CallerName,
          callee: 'b' as SymbolId,
          location: { file_path: 'test.js' as FilePath, line: 1, column: 0, end_line: 1, end_column: 10 },
          language: 'javascript',
          node_type: 'call_expression',
          is_async: false,
          is_dynamic: false,
          is_macro_call: false,
          is_in_comprehension: false,
          arguments_count: 0,
          modifiers: []
        },
        {
          kind: 'function',
          caller: 'b' as CallerName,
          callee: 'c' as SymbolId,
          location: { file_path: 'test.js' as FilePath, line: 2, column: 0, end_line: 2, end_column: 10 },
          language: 'javascript',
          node_type: 'call_expression',
          is_async: false,
          is_dynamic: false,
          is_macro_call: false,
          is_in_comprehension: false,
          arguments_count: 0,
          modifiers: []
        },
        {
          kind: 'function',
          caller: 'c' as CallerName,
          callee: 'd' as SymbolId,
          location: { file_path: 'test.js' as FilePath, line: 3, column: 0, end_line: 3, end_column: 10 },
          language: 'javascript',
          node_type: 'call_expression',
          is_async: false,
          is_dynamic: false,
          is_macro_call: false,
          is_in_comprehension: false,
          arguments_count: 0,
          modifiers: []
        }
      ];

      const context: CallChainContext = {
        language: 'javascript',
        max_depth: 2
      };

      const result = build_call_chains(calls, context);
      
      // Check that chains respect max depth
      const maxDepth = Math.max(...result.chains.map(chain => chain.depth));
      expect(maxDepth).toBeLessThanOrEqual(2);
    });

  });

  describe('detect_recursion', () => {
    it('should detect direct recursion', () => {
      const chains: CallChain[] = [
        {
          entry_point: 'factorial' as SymbolId,
          nodes: [
            {
              symbol_id: 'factorial' as SymbolId,
              location: { file_path: 'test.js' as FilePath, line: 3, column: 0, end_line: 3, end_column: 10 },
              depth: 1,
              is_recursive: true
            }
          ],
          depth: 1,
          has_recursion: true,
          execution_path: ['factorial' as SymbolId, 'factorial' as SymbolId]
        }
      ];

      const recursive = detect_recursion(chains);
      
      expect(recursive.length).toBe(1);
      expect(recursive[0].has_recursion).toBe(true);
      expect(recursive[0].entry_point).toBe('factorial' as SymbolId);
    });

    it('should detect indirect recursion', () => {
      const chains: CallChain[] = [
        {
          entry_point: 'isEven' as SymbolId,
          nodes: [
            {
              symbol_id: 'isOdd' as SymbolId,
              location: { file_path: 'test.js' as FilePath, line: 2, column: 0, end_line: 2, end_column: 10 },
              depth: 1,
              is_recursive: false
            },
            {
              symbol_id: 'isEven' as SymbolId,
              location: { file_path: 'test.js' as FilePath, line: 6, column: 0, end_line: 6, end_column: 10 },
              depth: 2,
              is_recursive: true
            }
          ],
          depth: 2,
          has_recursion: true,
          execution_path: ['isEven' as SymbolId, 'isOdd' as SymbolId, 'isEven' as SymbolId]
        }
      ];

      const recursive = detect_recursion(chains);
      
      expect(recursive.length).toBe(1);
      expect(recursive[0].has_recursion).toBe(true);
      expect(recursive[0].entry_point).toBe('isEven' as SymbolId);
    });
  });

  describe('find_paths_between', () => {
    it('should find direct path', () => {
      const call_graph = new Map<string, Set<string>>();
      call_graph.set('main', new Set(['foo']));
      call_graph.set('foo', new Set(['bar']));

      const paths = find_paths_between('main', 'bar', call_graph);
      
      expect(paths.length).toBe(1);
      expect(paths[0].nodes.length).toBe(2);
      expect(paths[0].nodes[0].symbol_id).toBe('main');
      expect(paths[0].nodes[1].symbol_id).toBe('bar');
    });

    it('should find multiple paths', () => {
      const call_graph = new Map<string, Set<string>>();
      call_graph.set('main', new Set(['path1', 'path2']));
      call_graph.set('path1', new Set(['target']));
      call_graph.set('path2', new Set(['target']));

      const paths = find_paths_between('main', 'target', call_graph);
      
      expect(paths.length).toBe(2);
    });

    it('should respect max_depth', () => {
      const call_graph = new Map<string, Set<string>>();
      call_graph.set('a', new Set(['b']));
      call_graph.set('b', new Set(['c']));
      call_graph.set('c', new Set(['d']));
      call_graph.set('d', new Set(['e']));

      const paths = find_paths_between('a', 'e', call_graph, 3);
      
      expect(paths.length).toBe(0); // Path exists but exceeds max_depth
    });
  });

  describe('get_longest_chain', () => {
    it('should return longest chain', () => {
      const chains: CallChain[] = [
        {
          entry_point: 'a' as SymbolId,
          nodes: [],
          depth: 2,
          has_recursion: false,
          execution_path: ['a' as SymbolId]
        },
        {
          entry_point: 'b' as SymbolId,
          nodes: [],
          depth: 5,
          has_recursion: false,
          execution_path: ['b' as SymbolId]
        },
        {
          entry_point: 'c' as SymbolId,
          nodes: [],
          depth: 3,
          has_recursion: false,
          execution_path: ['c' as SymbolId]
        }
      ];

      const longest = get_longest_chain(chains);
      
      expect(longest?.entry_point).toBe('b' as SymbolId);
      expect(longest?.depth).toBe(5);
    });

    it('should return null for empty chains', () => {
      const longest = get_longest_chain([]);
      expect(longest).toBeNull();
    });
  });

  describe('get_recursive_functions', () => {
    it('should identify all functions in recursive cycles', () => {
      const chains: CallChain[] = [
        {
          root: 'a',
          nodes: [
            {
              caller: 'a',
              callee: 'b',
              location: { file_path: 'test.js' as FilePath, line: 1, column: 0, end_line: 1, end_column: 10 },
              file_path: 'test.js' as FilePath,
              call_type: 'function',
              depth: 1
            },
            {
              caller: 'b',
              callee: 'c',
              location: { file_path: 'test.js' as FilePath, line: 2, column: 0, end_line: 2, end_column: 10 },
              file_path: 'test.js' as FilePath,
              call_type: 'function',
              depth: 2
            },
            {
              caller: 'c',
              callee: 'a',
              location: { file_path: 'test.js' as FilePath, line: 3, column: 0, end_line: 3, end_column: 10 },
              file_path: 'test.js' as FilePath,
              call_type: 'function',
              depth: 3
            }
          ],
          is_recursive: true,
          max_depth: 3,
          cycle_point: 'a'
        }
      ];

      const recursive_funcs = get_recursive_functions(chains);
      
      expect(recursive_funcs.size).toBe(3);
      expect(recursive_funcs.has('a')).toBe(true);
      expect(recursive_funcs.has('b')).toBe(true);
      expect(recursive_funcs.has('c')).toBe(true);
    });
  });

});