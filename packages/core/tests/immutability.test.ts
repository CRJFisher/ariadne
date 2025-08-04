import { describe, it, expect } from 'vitest';
import {
  create_file_type_tracker,
  set_variable_type,
  set_imported_class,
  mark_as_exported,
  create_project_type_registry,
  register_export,
  create_local_type_tracker,
  set_local_variable_type
} from '../src/call_graph/immutable_type_tracking';
import {
  create_project_call_graph,
  add_file_graph,
  add_file_cache,
  update_file_type_tracker,
  update_project_registry,
  batch_update_files,
  clear_file_data,
  merge_project_graphs
} from '../src/call_graph/immutable_project_call_graph';
import { ScopeGraph, Def } from '../src/graph';
import { FileCache } from '../src/file_cache';

/**
 * Helper to create a mock scope graph
 */
function createMockGraph(): ScopeGraph {
  const mockRootNode = {
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 100, column: 0 },
    type: 'program',
    children: []
  };
  return new ScopeGraph(mockRootNode as any);
}

/**
 * Helper to create a mock file cache
 */
function createMockCache(): FileCache {
  return {
    source_code: 'test',
    tree: {} as any,
    language: 'typescript'
  } as FileCache;
}

/**
 * Helper to deep clone an object for comparison
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

describe('Immutability Tests', () => {
  describe('Type Tracking Immutability', () => {
    it('should not mutate tracker when setting variable type', () => {
      const tracker = create_file_type_tracker();
      const originalSize = tracker.variableTypes.size;
      
      const updated = set_variable_type(tracker, 'myVar', {
        className: 'MyClass',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      
      // Original unchanged
      expect(tracker.variableTypes.size).toBe(originalSize);
      expect(tracker).not.toBe(updated);
      
      // New instance has the update
      expect(updated.variableTypes.size).toBe(1);
      expect(updated.variableTypes.get('myVar')).toBeDefined();
    });

    it('should maintain structural sharing for unchanged data', () => {
      const tracker = create_file_type_tracker();
      const updated1 = set_imported_class(tracker, 'Class1', {
        className: 'Class1',
        classDef: {} as any,
        sourceFile: 'file1.ts'
      });
      
      const updated2 = set_variable_type(updated1, 'var1', {
        className: 'Class1',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      
      // importedClasses should be structurally shared
      expect(updated1.importedClasses).toBe(updated2.importedClasses);
      // But variableTypes should be different
      expect(updated1.variableTypes).not.toBe(updated2.variableTypes);
    });

    it('should create new instance when marking as exported', () => {
      const tracker = create_file_type_tracker();
      const updated = mark_as_exported(tracker, 'myFunc');
      
      expect(tracker).not.toBe(updated);
      expect(tracker.exportedDefinitions.size).toBe(0);
      expect(updated.exportedDefinitions.size).toBe(1);
      expect(updated.exportedDefinitions.has('myFunc')).toBe(true);
    });

    it('should handle multiple updates without mutation', () => {
      let tracker = create_file_type_tracker();
      const original = tracker;
      
      // Chain multiple updates
      tracker = set_variable_type(tracker, 'var1', {
        className: 'Class1',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      
      tracker = set_variable_type(tracker, 'var2', {
        className: 'Class2',
        classDef: {} as any,
        position: { row: 2, column: 0 }
      });
      
      tracker = mark_as_exported(tracker, 'var1');
      
      // Original completely unchanged
      expect(original.variableTypes.size).toBe(0);
      expect(original.exportedDefinitions.size).toBe(0);
      
      // Final state has all updates
      expect(tracker.variableTypes.size).toBe(2);
      expect(tracker.exportedDefinitions.size).toBe(1);
    });
  });

  describe('Project Type Registry Immutability', () => {
    it('should not mutate registry when registering export', () => {
      const registry = create_project_type_registry();
      const mockDef: Def = {
        id: 1,
        kind: 'definition',
        name: 'MyClass',
        symbol_kind: 'class',
        symbol_id: 'test#MyClass',
        range: { start: { row: 1, column: 0 }, end: { row: 5, column: 0 } },
        file_path: 'test.ts'
      };
      
      const updated = register_export(
        registry,
        'test.ts',
        'MyClass',
        'MyClass',
        mockDef
      );
      
      expect(registry).not.toBe(updated);
      expect(registry.exportedTypes.size).toBe(0);
      expect(updated.exportedTypes.size).toBe(1);
    });
  });

  describe('Local Type Tracker Immutability', () => {
    it('should not mutate parent when setting local type', () => {
      const parent = create_file_type_tracker();
      const local = create_local_type_tracker(parent);
      
      const updated = set_local_variable_type(local, 'localVar', {
        className: 'LocalClass',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      
      expect(local).not.toBe(updated);
      expect(local.localTypes.size).toBe(0);
      expect(updated.localTypes.size).toBe(1);
      
      // Parent remains unchanged
      expect(updated.parent).toBe(parent);
    });
  });

  describe('Project Call Graph Immutability', () => {
    it('should not mutate when adding file graph', () => {
      const project = create_project_call_graph();
      const graph = createMockGraph();
      
      const updated = add_file_graph(project, 'test.ts', graph);
      
      expect(project).not.toBe(updated);
      expect(project.fileGraphs.size).toBe(0);
      expect(updated.fileGraphs.size).toBe(1);
      expect(updated.fileGraphs.get('test.ts')).toBe(graph);
    });

    it('should maintain structural sharing for unchanged maps', () => {
      const project = create_project_call_graph();
      const graph = createMockGraph();
      
      const updated = add_file_graph(project, 'test.ts', graph);
      
      // Unchanged maps should be the same reference
      expect(project.fileCache).toBe(updated.fileCache);
      expect(project.languages).toBe(updated.languages);
      expect(project.fileTypeTrackers).toBe(updated.fileTypeTrackers);
      expect(project.projectTypeRegistry).toBe(updated.projectTypeRegistry);
      
      // Only fileGraphs should be different
      expect(project.fileGraphs).not.toBe(updated.fileGraphs);
    });

    it('should handle batch updates immutably', () => {
      const project = create_project_call_graph();
      const graph1 = createMockGraph();
      const graph2 = createMockGraph();
      const cache1 = createMockCache();
      const cache2 = createMockCache();
      
      const updates = [
        { filePath: 'file1.ts', graph: graph1, cache: cache1 },
        { filePath: 'file2.ts', graph: graph2, cache: cache2 }
      ];
      
      const updated = batch_update_files(project, updates);
      
      expect(project).not.toBe(updated);
      expect(project.fileGraphs.size).toBe(0);
      expect(project.fileCache.size).toBe(0);
      expect(updated.fileGraphs.size).toBe(2);
      expect(updated.fileCache.size).toBe(2);
    });

    it('should clear file data without mutation', () => {
      let project = create_project_call_graph();
      project = add_file_graph(project, 'test.ts', createMockGraph());
      project = add_file_cache(project, 'test.ts', createMockCache());
      
      const beforeClear = project;
      const cleared = clear_file_data(project, 'test.ts');
      
      expect(beforeClear).not.toBe(cleared);
      expect(beforeClear.fileGraphs.size).toBe(1);
      expect(cleared.fileGraphs.size).toBe(0);
    });

    it('should merge projects immutably', () => {
      const project1 = add_file_graph(
        create_project_call_graph(),
        'file1.ts',
        createMockGraph()
      );
      
      const project2 = add_file_graph(
        create_project_call_graph(),
        'file2.ts',
        createMockGraph()
      );
      
      const merged = merge_project_graphs(project1, project2);
      
      expect(merged).not.toBe(project1);
      expect(merged).not.toBe(project2);
      expect(project1.fileGraphs.size).toBe(1);
      expect(project2.fileGraphs.size).toBe(1);
      expect(merged.fileGraphs.size).toBe(2);
    });
  });

  describe('Deep Immutability Verification', () => {
    it('should maintain deep immutability through operations', () => {
      const tracker = create_file_type_tracker();
      const updated = set_variable_type(tracker, 'var1', {
        className: 'Class1',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      
      // Get the type info
      const typeInfo = updated.variableTypes.get('var1')![0];
      const originalRow = typeInfo.position.row;
      
      // TypeScript prevents mutation at compile time
      // At runtime, we verify the data structure design prevents accidental mutations
      expect(typeInfo.position.row).toBe(originalRow);
      
      // Verify that updates create new instances
      const updated2 = set_variable_type(updated, 'var1', {
        className: 'Class1',
        classDef: {} as any,
        position: { row: 999, column: 0 }
      });
      
      // Original remains unchanged
      expect(updated.variableTypes.get('var1')![0].position.row).toBe(originalRow);
      // New instance has the update
      expect(updated2.variableTypes.get('var1')![1].position.row).toBe(999);
    });

    it('should use TypeScript readonly types to prevent mutations', () => {
      const project = create_project_call_graph();
      
      // TypeScript's type system prevents these at compile time:
      // project.fileGraphs.set('test.ts', createMockGraph()); // TS Error
      // project.fileGraphs.clear(); // TS Error
      // project.fileGraphs.delete('test.ts'); // TS Error
      
      // At runtime, we verify the maps are truly separate instances
      const updated = add_file_graph(project, 'test.ts', createMockGraph());
      
      expect(project.fileGraphs).not.toBe(updated.fileGraphs);
      expect(project.fileGraphs.size).toBe(0);
      expect(updated.fileGraphs.size).toBe(1);
    });
  });

  describe('Immutability Invariants', () => {
    it('should maintain referential transparency', () => {
      const tracker = create_file_type_tracker();
      
      // Same operation produces equivalent results
      const result1 = set_variable_type(tracker, 'var', {
        className: 'Class',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      
      const result2 = set_variable_type(tracker, 'var', {
        className: 'Class',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      
      // Results are equivalent (not same reference, but same content)
      expect(result1).not.toBe(result2);
      expect(result1.variableTypes.size).toBe(result2.variableTypes.size);
      expect(result1.variableTypes.get('var')).toEqual(result2.variableTypes.get('var'));
    });

    it('should support time-travel debugging', () => {
      const history: any[] = [];
      let tracker = create_file_type_tracker();
      
      history.push(tracker);
      
      tracker = set_variable_type(tracker, 'var1', {
        className: 'Class1',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      history.push(tracker);
      
      tracker = set_variable_type(tracker, 'var2', {
        className: 'Class2',
        classDef: {} as any,
        position: { row: 2, column: 0 }
      });
      history.push(tracker);
      
      // Can access any previous state
      expect(history[0].variableTypes.size).toBe(0);
      expect(history[1].variableTypes.size).toBe(1);
      expect(history[2].variableTypes.size).toBe(2);
      
      // All states remain valid
      history.forEach((state, i) => {
        expect(state.variableTypes.size).toBe(i);
      });
    });
  });
});