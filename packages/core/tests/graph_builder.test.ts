import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyze_file,
  analyze_all_files,
  build_from_analysis,
  build_call_graph_two_phase,
  build_call_graph_two_phase_sync,
  FileAnalysisData,
  ProjectAnalysisData,
  TwoPhaseBuildConfig
} from '../src/call_graph/graph_builder';
import { 
  create_project_call_graph,
  ProjectCallGraphData
} from '../src/call_graph/project_graph_data';
import { ScopeGraph, Def, Ref } from '../src/graph';
import { FileCache } from '../src/file_cache';
import { LanguageConfig } from '../src/types';

// Mock implementations
function createMockGraph(nodes: (Def | Ref)[] = []): ScopeGraph {
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

function createMockFileCache(sourceCode: string = '', language = 'typescript'): FileCache {
  return {
    source_code: sourceCode,
    tree: {
      rootNode: {
        descendantForPosition: () => null
      }
    } as any,
    language
  } as FileCache;
}

function createMockLanguageConfig(): LanguageConfig {
  return {
    language: 'typescript',
    file_extensions: ['.ts', '.tsx'],
    parser_name: 'tree-sitter-typescript',
    grammar: {} as any
  } as LanguageConfig;
}

function createMockDef(overrides: Partial<Def> = {}): Def {
  return {
    id: 1,
    kind: 'definition',
    name: 'testFunction',
    symbol_kind: 'function',
    symbol_id: 'test#testFunction',
    range: { start: { row: 1, column: 0 }, end: { row: 5, column: 0 } },
    file_path: 'test.ts',
    ...overrides
  };
}

describe('Immutable Graph Builder', () => {
  let mockConfig: TwoPhaseBuildConfig;
  
  beforeEach(() => {
    mockConfig = {
      fileGraphs: new Map(),
      fileCache: new Map(),
      languages: new Map([['typescript', createMockLanguageConfig()]]),
      goToDefinition: () => undefined,
      getImportsWithDefinitions: () => [],
      getAllFunctions: () => []
    };
  });

  describe('analyze_file', () => {
    it('should return undefined for non-existent file', () => {
      const result = analyze_file('not-exists.ts', mockConfig);
      expect(result).toBeUndefined();
    });

    it('should analyze file with exports', () => {
      const exportDef = createMockDef({
        name: 'exportedFunc',
        symbol_id: 'test#exportedFunc',
        symbol_kind: 'function',
        range: { start: { row: 0, column: 16 }, end: { row: 0, column: 28 } }
      });
      
      const graph = createMockGraph([exportDef]);
      const cache = createMockFileCache(`export function exportedFunc() {}`);
      
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      mockConfig.getAllFunctions = () => [exportDef];
      
      const result = analyze_file('test.ts', mockConfig);
      
      expect(result).toBeDefined();
      expect(result!.filePath).toBe('test.ts');
      expect(result!.exports).toHaveLength(1);
      expect(result!.exports[0].exportName).toBe('exportedFunc');
      expect(result!.imports).toHaveLength(0);
      expect(result!.calls).toHaveLength(2); // One for function, one for module-level
    });

    it('should analyze file with imports', () => {
      const importRef: Ref = {
        id: 1,
        kind: 'reference',
        name: 'importedFunc',
        symbol_kind: 'unknown',
        range: { start: { row: 0, column: 9 }, end: { row: 0, column: 21 } }
      };
      
      const graph = createMockGraph([importRef]);
      const cache = createMockFileCache(`import { importedFunc } from './other';`);
      
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      
      const result = analyze_file('test.ts', mockConfig);
      
      expect(result).toBeDefined();
      expect(result!.imports).toHaveLength(1);
      expect(result!.imports[0].localName).toBe('importedFunc');
    });

    it('should analyze function calls', () => {
      const funcDef = createMockDef({
        name: 'myFunction',
        range: { start: { row: 1, column: 0 }, end: { row: 5, column: 0 } }
      });
      
      const calledDef = createMockDef({
        id: 2,
        name: 'helper',
        symbol_id: 'test#helper',
        range: { start: { row: 10, column: 0 }, end: { row: 12, column: 0 } }
      });
      
      const callRef: Ref = {
        id: 3,
        kind: 'reference',
        name: 'helper',
        symbol_kind: 'function',
        range: { start: { row: 3, column: 4 }, end: { row: 3, column: 10 } }
      };
      
      const graph = createMockGraph([funcDef, calledDef, callRef]);
      const cache = createMockFileCache(`
function myFunction() {
  helper();
}

function helper() {}
`);
      
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      mockConfig.getAllFunctions = () => [funcDef, calledDef];
      mockConfig.goToDefinition = () => calledDef;
      
      const result = analyze_file('test.ts', mockConfig);
      
      expect(result).toBeDefined();
      expect(result!.calls).toHaveLength(3); // 2 functions + module-level
      expect(result!.calls[0].calls).toHaveLength(1);
      expect(result!.calls[0].calls[0].resolved_definition).toBe(calledDef);
    });

    it('should track type discoveries', () => {
      const classDef = createMockDef({
        name: 'MyClass',
        symbol_kind: 'class',
        symbol_id: 'test#MyClass'
      });
      
      const funcDef = createMockDef({
        name: 'test',
        range: { start: { row: 5, column: 0 }, end: { row: 8, column: 0 } }
      });
      
      const graph = createMockGraph([classDef, funcDef]);
      const cache = createMockFileCache(`
class MyClass {}

function test() {
  const obj = new MyClass();
}
`);
      
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      mockConfig.getAllFunctions = () => [funcDef];
      
      const result = analyze_file('test.ts', mockConfig);
      
      expect(result).toBeDefined();
      expect(result!.typeTracker).toBeDefined();
    });
  });

  describe('analyze_all_files', () => {
    it('should analyze multiple files in parallel', async () => {
      // Set up two files
      const file1Def = createMockDef({ 
        name: 'func1', 
        file_path: 'file1.ts' 
      });
      const file2Def = createMockDef({ 
        name: 'func2', 
        file_path: 'file2.ts' 
      });
      
      mockConfig.fileGraphs.set('file1.ts', createMockGraph([file1Def]));
      mockConfig.fileGraphs.set('file2.ts', createMockGraph([file2Def]));
      mockConfig.fileCache.set('file1.ts', createMockFileCache('export function func1() {}'));
      mockConfig.fileCache.set('file2.ts', createMockFileCache('export function func2() {}'));
      mockConfig.getAllFunctions = ({ file_filter }) => {
        if (file_filter) {
          if (file_filter('file1.ts')) return [file1Def];
          if (file_filter('file2.ts')) return [file2Def];
        }
        return [file1Def, file2Def];
      };
      
      const result = await analyze_all_files(mockConfig);
      
      expect(result.files.size).toBe(2);
      expect(result.files.has('file1.ts')).toBe(true);
      expect(result.files.has('file2.ts')).toBe(true);
      expect(result.projectRegistry).toBeDefined();
    });

    it('should build project registry with exports', async () => {
      const exportedDef = createMockDef({
        name: 'sharedFunc',
        symbol_id: 'test#sharedFunc',
        symbol_kind: 'function',
        file_path: 'shared.ts',
        range: { start: { row: 0, column: 16 }, end: { row: 0, column: 26 } }
      });
      
      const graph = createMockGraph([exportedDef]);
      const cache = createMockFileCache('export function sharedFunc() {}');
      
      mockConfig.fileGraphs.set('shared.ts', graph);
      mockConfig.fileCache.set('shared.ts', cache);
      mockConfig.getAllFunctions = ({ file_filter }) => {
        if (file_filter && file_filter('shared.ts')) return [exportedDef];
        return [exportedDef];
      };
      
      const result = await analyze_all_files(mockConfig);
      
      expect(result.projectRegistry.exportedTypes.size).toBe(1);
      // The key includes the module path
      const keys = Array.from(result.projectRegistry.exportedTypes.keys());
      expect(keys[0]).toContain('sharedFunc');
    });
  });

  describe('build_from_analysis', () => {
    it('should build immutable project from analysis', () => {
      const analysis: ProjectAnalysisData = {
        files: new Map([
          ['test.ts', {
            filePath: 'test.ts',
            exports: [],
            imports: [],
            calls: [],
            typeTracker: {
              variableTypes: new Map(),
              importedClasses: new Map(),
              exportedDefinitions: new Set()
            }
          }]
        ]),
        projectRegistry: {
          exportedTypes: new Map(),
          fileExports: new Map()
        }
      };
      
      const graph = createMockGraph();
      const cache = createMockFileCache();
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      
      const result = build_from_analysis(analysis, mockConfig);
      
      expect(result.fileGraphs.size).toBe(1);
      expect(result.fileCache.size).toBe(1);
      expect(result.fileTypeTrackers.size).toBe(1);
      expect(result.languages).toBe(mockConfig.languages);
    });

    it('should process imports during construction', () => {
      const importDef = createMockDef({
        name: 'helper',
        symbol_kind: 'import_statement'
      });
      
      const resolvedDef = createMockDef({
        name: 'helper',
        file_path: 'other.ts',
        symbol_id: 'other#helper'
      });
      
      const analysis: ProjectAnalysisData = {
        files: new Map([
          ['test.ts', {
            filePath: 'test.ts',
            exports: [],
            imports: [{
              importStatement: importDef,
              localName: 'helper',
              resolvedDefinition: resolvedDef,
              isTypeImport: false
            }],
            calls: [],
            typeTracker: {
              variableTypes: new Map(),
              importedClasses: new Map(),
              exportedDefinitions: new Set()
            }
          }]
        ]),
        projectRegistry: {
          exportedTypes: new Map([
            ['helper', {
              className: 'helper',
              classDef: resolvedDef,
              sourceFile: 'other.ts'
            }]
          ]),
          fileExports: new Map([
            ['other.ts', new Set(['helper'])]
          ])
        }
      };
      
      const graph = createMockGraph([importDef]);
      const cache = createMockFileCache();
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      
      const result = build_from_analysis(analysis, mockConfig);
      
      expect(result.fileTypeTrackers.size).toBe(1);
      const tracker = result.fileTypeTrackers.get('test.ts');
      expect(tracker).toBeDefined();
      expect(tracker!.importedClasses.size).toBeGreaterThan(0);
    });
  });

  describe('build_call_graph_two_phase', () => {
    it('should complete full two-phase build', async () => {
      const funcDef = createMockDef();
      const graph = createMockGraph([funcDef]);
      const cache = createMockFileCache('function testFunction() {}');
      
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      mockConfig.getAllFunctions = () => [funcDef];
      
      const result = await build_call_graph_two_phase(mockConfig);
      
      expect(result.fileGraphs.size).toBe(1);
      expect(result.fileCache.size).toBe(1);
      expect(result.fileTypeTrackers.size).toBe(1);
      expect(result.projectTypeRegistry).toBeDefined();
    });

    it('should handle empty project', async () => {
      const result = await build_call_graph_two_phase(mockConfig);
      
      expect(result.fileGraphs.size).toBe(0);
      expect(result.fileCache.size).toBe(0);
      expect(result.fileTypeTrackers.size).toBe(0);
    });
  });

  describe('build_call_graph_two_phase_sync', () => {
    it('should complete full two-phase build synchronously', () => {
      const funcDef = createMockDef();
      const graph = createMockGraph([funcDef]);
      const cache = createMockFileCache('function testFunction() {}');
      
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      mockConfig.getAllFunctions = () => [funcDef];
      
      const result = build_call_graph_two_phase_sync(mockConfig);
      
      expect(result.fileGraphs.size).toBe(1);
      expect(result.fileCache.size).toBe(1);
      expect(result.fileTypeTrackers.size).toBe(1);
    });
  });

  describe('Immutability verification', () => {
    it('should not mutate input config during analysis', () => {
      const originalGraphsSize = mockConfig.fileGraphs.size;
      const originalCacheSize = mockConfig.fileCache.size;
      
      analyze_file('test.ts', mockConfig);
      
      expect(mockConfig.fileGraphs.size).toBe(originalGraphsSize);
      expect(mockConfig.fileCache.size).toBe(originalCacheSize);
    });

    it('should create new instances during build', async () => {
      const graph = createMockGraph();
      const cache = createMockFileCache();
      
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      
      const result1 = await build_call_graph_two_phase(mockConfig);
      const result2 = await build_call_graph_two_phase(mockConfig);
      
      // Results should be different instances
      expect(result1).not.toBe(result2);
      expect(result1.fileGraphs).not.toBe(result2.fileGraphs);
      expect(result1.fileTypeTrackers).not.toBe(result2.fileTypeTrackers);
    });

    it('should maintain separation between analysis and construction', () => {
      const funcDef = createMockDef();
      const graph = createMockGraph([funcDef]);
      const cache = createMockFileCache();
      
      mockConfig.fileGraphs.set('test.ts', graph);
      mockConfig.fileCache.set('test.ts', cache);
      mockConfig.getAllFunctions = () => [funcDef];
      
      // Phase 1
      const analysisResult = analyze_file('test.ts', mockConfig);
      expect(analysisResult).toBeDefined();
      
      // Verify analysis result is self-contained
      expect(analysisResult!.filePath).toBe('test.ts');
      expect(analysisResult!.exports).toBeDefined();
      expect(analysisResult!.imports).toBeDefined();
      expect(analysisResult!.calls).toBeDefined();
      expect(analysisResult!.typeTracker).toBeDefined();
      
      // Phase 2
      const projectAnalysis: ProjectAnalysisData = {
        files: new Map([['test.ts', analysisResult!]]),
        projectRegistry: {
          exportedTypes: new Map(),
          fileExports: new Map()
        }
      };
      
      const finalResult = build_from_analysis(projectAnalysis, mockConfig);
      
      // Verify final result is complete
      expect(finalResult.fileGraphs.has('test.ts')).toBe(true);
      expect(finalResult.fileCache.has('test.ts')).toBe(true);
      expect(finalResult.fileTypeTrackers.has('test.ts')).toBe(true);
    });
  });
});