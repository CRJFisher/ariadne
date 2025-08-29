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
  CallChainContext,
  CallChain
} from './call_chain_analysis';
import { FunctionCallInfo } from '../function_calls';
import { MethodCallInfo } from '../method_calls';
import { ConstructorCallInfo } from '../constructor_calls';

describe('call_chain_analysis', () => {

  describe('build_call_chains', () => {
    it('should build simple linear chain', () => {
      const calls: FunctionCallInfo[] = [
        {
          caller_name: 'main',
          callee_name: 'foo',
          location: { row: 1, column: 0 },
          file_path: 'test.js',
          is_method_call: false,
          is_constructor_call: false,
          arguments_count: 0
        },
        {
          caller_name: 'foo',
          callee_name: 'bar',
          location: { row: 5, column: 0 },
          file_path: 'test.js',
          is_method_call: false,
          is_constructor_call: false,
          arguments_count: 0
        }
      ];

      const context: CallChainContext = {
        language: 'javascript',
        max_depth: 10,
        track_recursion: true
      };

      const result = build_call_chains(calls, context);
      
      expect(result.chains.length).toBeGreaterThan(0);
      expect(result.call_graph.has('main')).toBe(true);
      expect(result.call_graph.get('main')?.has('foo')).toBe(true);
      expect(result.call_graph.get('foo')?.has('bar')).toBe(true);
    });

    it('should detect recursive chains', () => {
      const calls: FunctionCallInfo[] = [
        {
          caller_name: 'factorial',
          callee_name: 'factorial',
          location: { row: 3, column: 0 },
          file_path: 'test.js',
          is_method_call: false,
          is_constructor_call: false,
          arguments_count: 1
        }
      ];

      const context: CallChainContext = {
        language: 'javascript',
        max_depth: 10,
        track_recursion: true
      };

      const result = build_call_chains(calls, context);
      
      expect(result.recursive_chains.length).toBeGreaterThan(0);
      expect(result.recursive_chains[0].is_recursive).toBe(true);
      expect(result.recursive_chains[0].cycle_point).toBe('factorial');
    });

    it('should handle method calls', () => {
      const calls: MethodCallInfo[] = [
        {
          caller_name: 'main',
          method_name: 'process',
          receiver_name: 'obj',
          location: { row: 2, column: 0 },
          file_path: 'test.js',
          is_static_method: false,
          is_chained_call: false,
          arguments_count: 0
        }
      ];

      const context: CallChainContext = {
        language: 'javascript',
        max_depth: 10
      };

      const result = build_call_chains(calls, context);
      
      expect(result.call_graph.has('main')).toBe(true);
      expect(result.call_graph.get('main')?.has('process')).toBe(true);
    });

    it('should handle constructor calls', () => {
      const calls: ConstructorCallInfo[] = [
        {
          constructor_name: 'MyClass',
          location: { row: 1, column: 0 },
          file_path: 'test.js',
          arguments_count: 0,
          assigned_to: 'instance',
          is_new_expression: true,
          is_factory_method: false
        }
      ];

      const context: CallChainContext = {
        language: 'javascript'
      };

      const result = build_call_chains(calls, context);
      
      expect(result.call_graph.has('<module>')).toBe(true);
      expect(result.call_graph.get('<module>')?.has('MyClass')).toBe(true);
    });

    it('should respect max_depth', () => {
      const calls: FunctionCallInfo[] = [
        {
          caller_name: 'a',
          callee_name: 'b',
          location: { row: 1, column: 0 },
          file_path: 'test.js',
          is_method_call: false,
          is_constructor_call: false,
          arguments_count: 0
        },
        {
          caller_name: 'b',
          callee_name: 'c',
          location: { row: 2, column: 0 },
          file_path: 'test.js',
          is_method_call: false,
          is_constructor_call: false,
          arguments_count: 0
        },
        {
          caller_name: 'c',
          callee_name: 'd',
          location: { row: 3, column: 0 },
          file_path: 'test.js',
          is_method_call: false,
          is_constructor_call: false,
          arguments_count: 0
        }
      ];

      const context: CallChainContext = {
        language: 'javascript',
        max_depth: 2
      };

      const result = build_call_chains(calls, context);
      
      expect(result.max_chain_depth).toBeLessThanOrEqual(2);
    });

  });

  describe('detect_recursion', () => {
    it('should detect direct recursion', () => {
      const chains: CallChain[] = [
        {
          root: 'factorial',
          nodes: [
            {
              caller: 'factorial',
              callee: 'factorial',
              location: { row: 3, column: 0 },
              file_path: 'test.js',
              call_type: 'function',
              depth: 1
            }
          ],
          is_recursive: false,
          max_depth: 1
        }
      ];

      const recursive = detect_recursion(chains);
      
      expect(recursive.length).toBe(1);
      expect(recursive[0].is_recursive).toBe(true);
      expect(recursive[0].cycle_point).toBe('factorial');
    });

    it('should detect indirect recursion', () => {
      const chains: CallChain[] = [
        {
          root: 'isEven',
          nodes: [
            {
              caller: 'isEven',
              callee: 'isOdd',
              location: { row: 2, column: 0 },
              file_path: 'test.js',
              call_type: 'function',
              depth: 1
            },
            {
              caller: 'isOdd',
              callee: 'isEven',
              location: { row: 6, column: 0 },
              file_path: 'test.js',
              call_type: 'function',
              depth: 2
            }
          ],
          is_recursive: false,
          max_depth: 2
        }
      ];

      const recursive = detect_recursion(chains);
      
      expect(recursive.length).toBe(1);
      expect(recursive[0].is_recursive).toBe(true);
      expect(recursive[0].cycle_point).toBe('isEven');
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
      expect(paths[0].nodes[0].caller).toBe('main');
      expect(paths[0].nodes[1].callee).toBe('bar');
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
          root: 'a',
          nodes: [],
          is_recursive: false,
          max_depth: 2
        },
        {
          root: 'b',
          nodes: [],
          is_recursive: false,
          max_depth: 5
        },
        {
          root: 'c',
          nodes: [],
          is_recursive: false,
          max_depth: 3
        }
      ];

      const longest = get_longest_chain(chains);
      
      expect(longest?.root).toBe('b');
      expect(longest?.max_depth).toBe(5);
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
              location: { row: 1, column: 0 },
              file_path: 'test.js',
              call_type: 'function',
              depth: 1
            },
            {
              caller: 'b',
              callee: 'c',
              location: { row: 2, column: 0 },
              file_path: 'test.js',
              call_type: 'function',
              depth: 2
            },
            {
              caller: 'c',
              callee: 'a',
              location: { row: 3, column: 0 },
              file_path: 'test.js',
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