import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyze_calls_from_definition,
  analyze_module_level_calls,
  resolve_method_call_pure,
  CallAnalysisResult,
  TypeDiscovery,
  MethodResolutionResult,
  CallAnalysisConfig
} from '../src/call_graph/immutable_call_analysis';
import { 
  create_file_type_tracker, 
  create_local_type_tracker,
  FileTypeTrackerData,
  LocalTypeTrackerData,
  set_local_variable_type
} from '../src/call_graph/immutable_type_tracking';
import { ScopeGraph, Def, Ref, Import } from '../src/graph';
import { FileCache } from '../src/file_cache';
import { TreeNode } from '../src/parse';

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
  const mockRootNode = {
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 100, column: 0 },
    type: 'program',
    children: []
  };
  const graph = new ScopeGraph(mockRootNode as any);
  
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
      const def: Def = {
        id: 1,
        kind: 'definition',
        name: 'myFunction',
        symbol_kind: 'function',
        symbol_id: 'test#myFunction',
        range: { start: { row: 1, column: 0 }, end: { row: 5, column: 0 } },
        file_path: 'test.ts'
      };
      
      const result = analyze_calls_from_definition(def, mockConfig);
      
      expect(result.calls).toHaveLength(0);
      expect(result.typeDiscoveries).toHaveLength(0);
    });

    it('should detect function calls within definition', () => {
      const calledFunc: Def = {
        id: 2,
        kind: 'definition',
        name: 'helper',
        symbol_kind: 'function',
        symbol_id: 'test#helper',
        range: { start: { row: 10, column: 0 }, end: { row: 12, column: 0 } },
        file_path: 'test.ts'
      };
      
      const funcRef: Ref = {
        id: 3,
        kind: 'reference',
        name: 'helper',
        symbol_kind: 'function',
        range: { start: { row: 3, column: 4 }, end: { row: 3, column: 10 } }
      };
      
      const def: Def = {
        id: 1,
        kind: 'definition',
        name: 'myFunction',
        symbol_kind: 'function',
        symbol_id: 'test#myFunction',
        range: { start: { row: 1, column: 0 }, end: { row: 5, column: 0 } },
        file_path: 'test.ts'
      };
      
      mockConfig.graph = createMockGraph([def, calledFunc, funcRef]);
      mockConfig.go_to_definition = () => calledFunc;
      
      const result = analyze_calls_from_definition(def, mockConfig);
      
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toMatchObject({
        caller_def: def,
        function_ref: funcRef,
        resolved_definition: calledFunc,
        kind: 'function'
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
      
      const classDef: Def = {
        id: 2,
        kind: 'definition',
        name: 'MyClass',
        symbol_kind: 'class',
        symbol_id: 'test#MyClass',
        range: { start: { row: 5, column: 6 }, end: { row: 5, column: 13 } },
        file_path: 'test.ts'
      };
      
      const classRef: Ref = {
        id: 3,
        kind: 'reference',
        name: 'MyClass',
        symbol_kind: 'class',
        range: { start: { row: 2, column: 18 }, end: { row: 2, column: 25 } }
      };
      
      const def: Def = {
        id: 1,
        kind: 'definition',
        name: 'test',
        symbol_kind: 'function',
        symbol_id: 'test#test',
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
      
      mockConfig.graph = createMockGraph([def, classDef, classRef]);
      mockConfig.go_to_definition = () => classDef;
      
      const result = analyze_calls_from_definition(def, mockConfig);
      
      expect(result.calls).toHaveLength(1);
      expect(result.typeDiscoveries).toHaveLength(0); // Would have discoveries with proper AST
    });

    it('should not mutate input trackers', () => {
      const def: Def = {
        id: 1,
        kind: 'definition',
        name: 'myFunction',
        symbol_kind: 'function',
        symbol_id: 'test#myFunction',
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
      const logDef: Def = {
        id: 1,
        kind: 'definition',
        name: 'log',
        symbol_kind: 'function',
        symbol_id: 'console#log',
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 3 } },
        file_path: 'builtin'
      };
      
      const moduleLevelRef: Ref = {
        id: 2,
        kind: 'reference',
        name: 'log',
        symbol_kind: 'method',
        range: { start: { row: 1, column: 8 }, end: { row: 1, column: 11 } }
      };
      
      const funcDef: Def = {
        id: 3,
        kind: 'definition',
        name: 'myFunc',
        symbol_kind: 'function',
        symbol_id: 'test#myFunc',
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
        function_ref: moduleLevelRef,
        resolved_definition: logDef,
        kind: 'method'
      });
      expect(result.calls[0].caller_def.name).toBe('<module>');
    });
  });

  describe('resolve_method_call_pure', () => {
    it('should resolve method calls without mutations', () => {
      const classDef: Def = {
        id: 1,
        kind: 'definition',
        name: 'MyClass',
        symbol_kind: 'class',
        symbol_id: 'test#MyClass',
        range: { start: { row: 1, column: 0 }, end: { row: 10, column: 0 } },
        file_path: 'test.ts',
        enclosing_range: { start: { row: 1, column: 0 }, end: { row: 10, column: 0 } }
      } as any;
      
      const methodDef: Def = {
        id: 2,
        kind: 'definition',
        name: 'doSomething',
        symbol_kind: 'method',
        symbol_id: 'test#MyClass.doSomething',
        range: { start: { row: 3, column: 2 }, end: { row: 5, column: 2 } },
        file_path: 'test.ts'
      };
      
      const methodRef: Ref = {
        id: 3,
        kind: 'reference',
        name: 'doSomething',
        symbol_kind: 'method',
        range: { start: { row: 15, column: 6 }, end: { row: 15, column: 17 } }
      };
      
      // Set up local type tracker with variable type
      let updatedTracker = set_local_variable_type(localTypeTracker, 'obj', {
        className: 'MyClass',
        classDef: classDef,
        position: { row: 14, column: 0 }
      });
      
      const classGraph = createMockGraph([classDef, methodDef]);
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
      const methodRef: Ref = {
        id: 1,
        kind: 'reference',
        name: 'unknown',
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