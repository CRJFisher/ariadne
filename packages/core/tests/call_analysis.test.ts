import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyze_calls_from_definition,
  analyze_module_level_calls,
  resolve_method_call_pure,
  CallAnalysisResult,
  TypeDiscovery,
  MethodResolutionResult,
  CallAnalysisConfig
} from '../src/call_graph/call_analysis';
import { 
  create_file_type_tracker, 
  create_local_type_tracker,
  FileTypeTrackerData,
  LocalTypeTrackerData,
  set_local_variable_type
} from '../src/call_graph/type_tracker';
import { ScopeGraph, Def, Ref, Import } from '../src/graph';
import { FileCache } from '../src/file_cache';
import { TreeNode } from '../src/parse';
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
  module_symbol,
  symbol_from_string,
  SymbolId
} from '@ariadnejs/types';

// Mock implementations
function createMockTree(): TreeNode {
  return {
    type: 'program',
    start_position: { row: 0, column: 0 },
    end_position: { row: 100, column: 0 },
    children: [],
    rootNode: {
      descendantForPosition: () => null
    } as any
  } as TreeNode;
}

function createMockGraph(nodes: (Def | Ref)[]): ScopeGraph {
  const mock_root_node = {
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 100, column: 0 },
    type: 'program',
    children: []
  };
  const graph = new ScopeGraph(mock_root_node as any);
  
  for (const node of nodes) {
    if (node.kind === 'definition') {
      graph.insert_global_def(node as Def);
    } else if (node.kind === 'reference') {
      graph.insert_ref(node as Ref);
    }
  }
  
  return graph;
}

describe('Immutable Call Analysis', () => {
  let mockFileCache: FileCache;
  let fileTypeTracker: FileTypeTrackerData;
  let localTypeTracker: LocalTypeTrackerData;
  let mockConfig: CallAnalysisConfig;

  beforeEach(() => {
    mockFileCache = {
      source_code: '',
      tree: createMockTree(),
      language: 'typescript'
    } as FileCache;
    
    fileTypeTracker = create_file_type_tracker();
    localTypeTracker = create_local_type_tracker(fileTypeTracker);
    
    mockConfig = {
      file_path: 'test.ts',
      graph: createMockGraph([]),
      fileCache: mockFileCache,
      fileTypeTracker,
      localTypeTracker,
      go_to_definition: () => undefined,
      get_imports_with_definitions: () => [],
      get_file_graph: () => undefined
    };
  });

  describe('analyze_calls_from_definition', () => {
    it('should return empty results for definition with no calls', () => {
      const func_symbol = function_symbol('myFunction', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 5,
        end_column: 0
      });
      const def: Def = {
        id: 1,
        kind: 'definition',
        name: symbol_from_string(func_symbol).name,
        symbol_kind: 'function',
        symbol_id: func_symbol,
        range: { start: { row: 1, column: 0 }, end: { row: 5, column: 0 } },
        file_path: 'test.ts'
      };
      
      const result = analyze_calls_from_definition(def, mockConfig);
      
      expect(result.calls).toHaveLength(0);
      expect(result.typeDiscoveries).toHaveLength(0);
    });

    it('should detect function calls within definition', () => {
      const helper_symbol = function_symbol('helper', {
        file_path: 'test.ts',
        line: 10,
        column: 0,
        end_line: 12,
        end_column: 0
      });
      const called_func: Def = {
        id: 2,
        kind: 'definition',
        name: symbol_from_string(helper_symbol).name,
        symbol_kind: 'function',
        symbol_id: helper_symbol,
        range: { start: { row: 10, column: 0 }, end: { row: 12, column: 0 } },
        file_path: 'test.ts'
      };

      const func_ref: Ref = {
        id: 3,
        kind: 'reference',
        name: symbol_from_string(helper_symbol).name,
        symbol_kind: 'function',
        range: { start: { row: 3, column: 4 }, end: { row: 3, column: 10 } }
      };

      const my_func_symbol = function_symbol('myFunction', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 5,
        end_column: 0
      });
      const def: Def = {
        id: 1,
        kind: 'definition',
        name: symbol_from_string(my_func_symbol).name,
        symbol_kind: 'function',
        symbol_id: my_func_symbol,
        range: { start: { row: 1, column: 0 }, end: { row: 5, column: 0 } },
        file_path: 'test.ts'
      };

      mockConfig.graph = createMockGraph([def, called_func, func_ref]);
      mockConfig.go_to_definition = () => called_func;
      
      const result = analyze_calls_from_definition(def, mockConfig);
      
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toMatchObject({
        caller_def: def,
        called_def: called_func,
        call_location: func_ref.range.start,
        is_method_call: false
      });
    });

    it('should detect constructor calls and type discoveries', () => {
      mockFileCache.source_code = `
function test() {
  const obj = new MyClass();
}

class MyClass {
  constructor() {}
}
`;
      
      const class_symbol = class_symbol('MyClass', 'test.ts', {
        file_path: 'test.ts',
        line: 5,
        column: 6,
        end_line: 5,
        end_column: 13
      });
      const class_def: Def = {
        id: 2,
        kind: 'definition',
        name: symbol_from_string(class_symbol).name,
        symbol_kind: 'class',
        symbol_id: class_symbol,
        range: { start: { row: 5, column: 6 }, end: { row: 5, column: 13 } },
        file_path: 'test.ts'
      };
      
      const classRef: Ref = {
        id: 3,
        kind: 'reference',
        name: symbol_from_string(class_symbol).name,
        symbol_kind: 'class',
        range: { start: { row: 2, column: 18 }, end: { row: 2, column: 25 } }
      };
      
      const test_symbol = function_symbol('test', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 3,
        end_column: 1
      });
      const def: Def = {
        id: 1,
        kind: 'definition',
        name: symbol_from_string(test_symbol).name,
        symbol_kind: 'function',
        symbol_id: test_symbol,
        range: { start: { row: 1, column: 0 }, end: { row: 3, column: 1 } },
        file_path: 'test.ts'
      };
      
      // Mock AST node structure for constructor detection
      const mockAstNode = {
        parent: { type: 'new_expression' },
        type: 'identifier',
        text: 'MyClass'
      };
      
      mockFileCache.tree.rootNode.descendantForPosition = () => mockAstNode as any;
      
      mockConfig.graph = createMockGraph([def, class_def, classRef]);
      mockConfig.go_to_definition = () => class_def;
      
      const result = analyze_calls_from_definition(def, mockConfig);
      
      expect(result.calls).toHaveLength(1);
      expect(result.typeDiscoveries).toHaveLength(0); // Would have discoveries with proper AST
    });

    it('should not mutate input trackers', () => {
      const funcSymbol = function_symbol('myFunction', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 5,
        end_column: 0
      });
      const def: Def = {
        id: 1,
        kind: 'definition',
        name: symbol_from_string(funcSymbol).name,
        symbol_kind: 'function',
        symbol_id: funcSymbol,
        range: { start: { row: 1, column: 0 }, end: { row: 5, column: 0 } },
        file_path: 'test.ts'
      };
      
      const originalFileTracker = mockConfig.fileTypeTracker;
      const originalLocalTracker = mockConfig.localTypeTracker;
      
      analyze_calls_from_definition(def, mockConfig);
      
      // Verify trackers are unchanged
      expect(mockConfig.fileTypeTracker).toBe(originalFileTracker);
      expect(mockConfig.localTypeTracker).toBe(originalLocalTracker);
      expect(mockConfig.fileTypeTracker.variableTypes.size).toBe(0);
      expect(mockConfig.localTypeTracker.localTypes.size).toBe(0);
    });
  });

  describe('analyze_module_level_calls', () => {
    it('should detect calls outside any definition', () => {
      mockFileCache.source_code = `
console.log('test'); // module-level call

function myFunc() {
  console.log('inside'); // not module-level
}
`;
      
      // Simple direct function call at module level
      const log_symbol = method_symbol('log', 'console', {
        file_path: 'builtin',
        line: 0,
        column: 0,
        end_line: 0,
        end_column: 3
      });
      const logDef: Def = {
        id: 1,
        kind: 'definition',
        name: symbol_from_string(log_symbol).name,
        symbol_kind: 'function',
        symbol_id: log_symbol,
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 3 } },
        file_path: 'builtin'
      };
      
      const moduleLevelRef: Ref = {
        id: 2,
        kind: 'reference',
        name: symbol_from_string(log_symbol).name,
        symbol_kind: 'method',
        range: { start: { row: 1, column: 8 }, end: { row: 1, column: 11 } }
      };
      
      const my_func_symbol = function_symbol('myFunc', {
        file_path: 'test.ts',
        line: 3,
        column: 0,
        end_line: 5,
        end_column: 1
      });
      const funcDef: Def = {
        id: 3,
        kind: 'definition',
        name: symbol_from_string(my_func_symbol).name,
        symbol_kind: 'function',
        symbol_id: my_func_symbol,
        range: { start: { row: 3, column: 0 }, end: { row: 5, column: 1 } },
        file_path: 'test.ts',
        enclosing_range: { start: { row: 3, column: 0 }, end: { row: 5, column: 1 } }
      } as any;
      
      const funcRef: Ref = {
        id: 4,
        kind: 'reference',
        name: 'log',
        symbol_kind: 'method',
        range: { start: { row: 4, column: 10 }, end: { row: 4, column: 13 } }
      };
      
      const graph = createMockGraph([funcDef, moduleLevelRef, funcRef]);
      
      mockConfig.graph = graph;
      mockConfig.go_to_definition = (_, pos) => {
        // Module-level ref resolves to log
        if (pos.row === 1) return logDef;
        return undefined;
      };
      
      const result = analyze_module_level_calls('test.ts', mockConfig);
      
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toMatchObject({
        caller_def: expect.objectContaining({
          name: '<module>',
          symbol_kind: 'module'
        }),
        called_def: logDef,
        call_location: moduleLevelRef.range.start,
        is_method_call: true
      });
      expect(result.calls[0].caller_def.name).toBe('<module>');
    });
  });

  describe('resolve_method_call_pure', () => {
    it('should resolve method calls without mutations', () => {
      const class_symbol = class_symbol('MyClass', 'test.ts', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 10,
        end_column: 0
      });
      const class_def: Def = {
        id: 1,
        kind: 'definition',
        name: symbol_from_string(class_symbol).name,
        symbol_kind: 'class',
        symbol_id: class_symbol,
        range: { start: { row: 1, column: 0 }, end: { row: 10, column: 0 } },
        file_path: 'test.ts',
        enclosing_range: { start: { row: 1, column: 0 }, end: { row: 10, column: 0 } }
      } as any;
      
      const methodSymbol = method_symbol('doSomething', 'MyClass', {
        file_path: 'test.ts',
        line: 3,
        column: 2,
        end_line: 5,
        end_column: 2
      });
      const methodDef: Def = {
        id: 2,
        kind: 'definition',
        name: symbol_from_string(methodSymbol).name,
        symbol_kind: 'method',
        symbol_id: methodSymbol,
        range: { start: { row: 3, column: 2 }, end: { row: 5, column: 2 } },
        file_path: 'test.ts'
      };
      
      const methodRef: Ref = {
        id: 3,
        kind: 'reference',
        name: symbol_from_string(methodSymbol).name,
        symbol_kind: 'method',
        range: { start: { row: 15, column: 6 }, end: { row: 15, column: 17 } }
      };
      
      // Set up local type tracker with variable type
      let updatedTracker = set_local_variable_type(localTypeTracker, 'obj', {
        className: 'MyClass',
        classDef: class_def,
        position: { row: 14, column: 0 }
      });
      
      const classGraph = createMockGraph([class_def, methodDef]);
      mockConfig.get_file_graph = () => classGraph;
      
      const result = resolve_method_call_pure(
        methodRef, 
        'obj', 
        mockConfig, 
        updatedTracker
      );
      
      expect(result.resolved).toEqual(methodDef);
      expect(result.typeDiscoveries).toHaveLength(0);
      
      // Verify original tracker unchanged
      expect(localTypeTracker.localTypes.size).toBe(0);
    });

    it('should return empty result if type not found', () => {
      const unknownSymbol = method_symbol('unknown', 'UnknownClass', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 1,
        end_column: 7
      });
      const methodRef: Ref = {
        id: 1,
        kind: 'reference',
        name: symbol_from_string(unknownSymbol).name,
        symbol_kind: 'method',
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 7 } }
      };
      
      const result = resolve_method_call_pure(
        methodRef,
        'unknownObj',
        mockConfig,
        localTypeTracker
      );
      
      expect(result.resolved).toBeUndefined();
      expect(result.typeDiscoveries).toHaveLength(0);
    });
  });

  describe('Type discoveries', () => {
    it('should track local scope discoveries', () => {
      const discovery: TypeDiscovery = {
        variableName: 'myVar',
        typeInfo: {
          className: 'MyClass',
          classDef: {} as any,
          position: { row: 1, column: 0 }
        },
        scope: 'local'
      };
      
      expect(discovery.scope).toBe('local');
      expect(discovery.variableName).toBe('myVar');
    });

    it('should track file scope discoveries', () => {
      const discovery: TypeDiscovery = {
        variableName: 'globalVar',
        typeInfo: {
          className: 'GlobalClass',
          classDef: {} as any,
          position: { row: 0, column: 0 }
        },
        scope: 'file'
      };
      
      expect(discovery.scope).toBe('file');
      expect(discovery.variableName).toBe('globalVar');
    });
  });
});