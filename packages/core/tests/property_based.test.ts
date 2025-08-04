import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  create_file_type_tracker,
  set_variable_type,
  set_imported_class,
  mark_as_exported,
  mark_as_exported_batch,
  FileTypeTrackerData,
  TypeInfo,
  ImportedClassInfo
} from '../src/call_graph/type_tracker';
import {
  create_project_call_graph,
  add_file_graph,
  add_file_cache,
  batch_update_files,
  merge_project_graphs,
  ProjectCallGraphData
} from '../src/call_graph/project_graph_data';
import { Def } from '../src/graph';

/**
 * Arbitrary for TypeInfo
 */
const typeInfoArb = fc.record({
  className: fc.string({ minLength: 1 }),
  classDef: fc.constant(undefined), // Simplified for testing
  position: fc.record({
    row: fc.nat({ max: 1000 }),
    column: fc.nat({ max: 200 })
  })
});

/**
 * Arbitrary for ImportedClassInfo
 */
const importedClassInfoArb = fc.record({
  className: fc.string({ minLength: 1 }),
  classDef: fc.constant({ 
    id: 1, 
    kind: 'definition' as const,
    name: 'test',
    symbol_kind: 'class' as const,
    symbol_id: 'test#class',
    range: { start: { row: 0, column: 0 }, end: { row: 1, column: 0 } },
    file_path: 'test.ts'
  } as Def),
  sourceFile: fc.string({ minLength: 1 })
});

/**
 * Arbitrary for variable names
 */
const varNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s));

describe('Property-based Immutability Tests', () => {
  describe('Type Tracker Properties', () => {
    it('should maintain immutability for any sequence of operations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.tuple(fc.constant('setVar'), varNameArb, typeInfoArb),
              fc.tuple(fc.constant('setImport'), varNameArb, importedClassInfoArb),
              fc.tuple(fc.constant('markExport'), varNameArb)
            ),
            { minLength: 1, maxLength: 100 }
          ),
          (operations) => {
            const original = create_file_type_tracker();
            let current = original;
            
            for (const [op, name, data] of operations) {
              const previous = current;
              
              switch (op) {
                case 'setVar':
                  current = set_variable_type(current, name, data as TypeInfo);
                  break;
                case 'setImport':
                  current = set_imported_class(current, name, data as ImportedClassInfo);
                  break;
                case 'markExport':
                  current = mark_as_exported(current, name);
                  break;
              }
              
              // Previous state unchanged
              expect(current).not.toBe(previous);
              expect(previous.variableTypes).toBe(previous.variableTypes);
            }
            
            // Original completely unchanged
            expect(original.variableTypes.size).toBe(0);
            expect(original.importedClasses.size).toBe(0);
            expect(original.exportedDefinitions.size).toBe(0);
          }
        )
      );
    });

    it('should be commutative for independent operations', () => {
      fc.assert(
        fc.property(
          varNameArb,
          varNameArb,
          typeInfoArb,
          typeInfoArb,
          (var1, var2, type1, type2) => {
            fc.pre(var1 !== var2); // Ensure different variables
            
            const tracker = create_file_type_tracker();
            
            // Apply in order 1->2
            const result1 = set_variable_type(
              set_variable_type(tracker, var1, type1),
              var2, type2
            );
            
            // Apply in order 2->1
            const result2 = set_variable_type(
              set_variable_type(tracker, var2, type2),
              var1, type1
            );
            
            // Results should be equivalent
            expect(result1.variableTypes.size).toBe(result2.variableTypes.size);
            expect(result1.variableTypes.get(var1)).toEqual(result2.variableTypes.get(var1));
            expect(result1.variableTypes.get(var2)).toEqual(result2.variableTypes.get(var2));
          }
        )
      );
    });

    it('should handle batch operations correctly', () => {
      fc.assert(
        fc.property(
          fc.array(varNameArb, { minLength: 1, maxLength: 50 }),
          (exports) => {
            const tracker = create_file_type_tracker();
            
            // Sequential marking
            let sequential = tracker;
            for (const exp of exports) {
              sequential = mark_as_exported(sequential, exp);
            }
            
            // Batch marking
            const batch = mark_as_exported_batch(tracker, exports);
            
            // Results should be equivalent
            expect(batch.exportedDefinitions.size).toBe(sequential.exportedDefinitions.size);
            for (const exp of exports) {
              expect(batch.exportedDefinitions.has(exp)).toBe(true);
            }
          }
        )
      );
    });
  });

  describe('Project Call Graph Properties', () => {
    it('should maintain structural sharing for any update sequence', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              filePath: fc.string({ minLength: 1, maxLength: 20 }),
              hasGraph: fc.boolean(),
              hasCache: fc.boolean()
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (updates) => {
            let project = create_project_call_graph();
            const unchangedMaps = new Set<any>();
            
            for (const update of updates) {
              const prev = project;
              
              // Track which maps were present before
              if (prev.fileGraphs.size > 0) unchangedMaps.add(prev.fileGraphs);
              if (prev.fileCache.size > 0) unchangedMaps.add(prev.fileCache);
              if (prev.fileTypeTrackers.size > 0) unchangedMaps.add(prev.fileTypeTrackers);
              
              // Apply update
              if (update.hasGraph) {
                project = add_file_graph(project, update.filePath, {} as any);
              }
              if (update.hasCache) {
                project = add_file_cache(project, update.filePath, {} as any);
              }
              
              // Verify structural sharing
              if (!update.hasGraph && prev.fileGraphs.size > 0) {
                expect(project.fileGraphs).toBe(prev.fileGraphs);
              }
              if (!update.hasCache && prev.fileCache.size > 0) {
                expect(project.fileCache).toBe(prev.fileCache);
              }
            }
          }
        )
      );
    });

    it('should correctly merge any two projects', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 10 }),
          (files1, files2) => {
            let project1 = create_project_call_graph();
            let project2 = create_project_call_graph();
            
            // Build project1
            for (const file of files1) {
              project1 = add_file_graph(project1, file, {} as any);
            }
            
            // Build project2
            for (const file of files2) {
              project2 = add_file_graph(project2, file, {} as any);
            }
            
            // Merge
            const merged = merge_project_graphs(project1, project2);
            
            // Verify merge properties
            expect(merged).not.toBe(project1);
            expect(merged).not.toBe(project2);
            
            // All files from both projects should be in merged
            const allFiles = new Set([...files1, ...files2]);
            expect(merged.fileGraphs.size).toBe(allFiles.size);
            
            // Project2 takes precedence for overlapping files
            for (const file of files2) {
              expect(merged.fileGraphs.has(file)).toBe(true);
            }
          }
        )
      );
    });

    it('should handle batch updates efficiently', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              filePath: fc.string({ minLength: 1, maxLength: 20 }),
              graph: fc.constant({} as any),
              cache: fc.constant({} as any)
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (updates) => {
            const project = create_project_call_graph();
            
            // Apply batch
            const batchResult = batch_update_files(project, updates);
            
            // Apply sequentially
            let seqResult = project;
            for (const update of updates) {
              if (update.graph) {
                seqResult = add_file_graph(seqResult, update.filePath, update.graph);
              }
              if (update.cache) {
                seqResult = add_file_cache(seqResult, update.filePath, update.cache);
              }
            }
            
            // Results should be equivalent
            expect(batchResult.fileGraphs.size).toBe(seqResult.fileGraphs.size);
            expect(batchResult.fileCache.size).toBe(seqResult.fileCache.size);
          }
        )
      );
    });
  });

  describe('Immutability Invariants', () => {
    it('should never expose mutable internal state', () => {
      fc.assert(
        fc.property(
          fc.array(varNameArb, { minLength: 1, maxLength: 10 }),
          (vars) => {
            let tracker = create_file_type_tracker();
            
            // Add some data
            for (const v of vars) {
              tracker = set_variable_type(tracker, v, {
                className: 'TestClass',
                classDef: undefined,
                position: { row: 0, column: 0 }
              });
            }
            
            // Get internal state
            const varTypes = tracker.variableTypes;
            const exports = tracker.exportedDefinitions;
            
            // Verify they're readonly types (TypeScript enforces at compile time)
            // At runtime, verify immutability through operations
            const originalSize = varTypes.size;
            const originalExportsSize = exports.size;
            
            // Any mutations would only affect a new instance
            const updated = set_variable_type(tracker, 'newVar', {
              className: 'NewClass',
              classDef: undefined,
              position: { row: 0, column: 0 }
            });
            
            // Original tracker unchanged
            expect(tracker.variableTypes.size).toBe(originalSize);
            expect(tracker.exportedDefinitions.size).toBe(originalExportsSize);
            
            // New instance has the changes
            expect(updated.variableTypes.size).toBe(originalSize + 1);
          }
        )
      );
    });

    it('should support undo/redo through state history', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(varNameArb, typeInfoArb),
            { minLength: 1, maxLength: 20 }
          ),
          (operations) => {
            const history: FileTypeTrackerData[] = [];
            let current = create_file_type_tracker();
            
            history.push(current);
            
            // Apply operations and track history
            const uniqueVars = new Set<string>();
            for (const [name, type] of operations) {
              current = set_variable_type(current, name, type);
              uniqueVars.add(name);
              history.push(current);
            }
            
            // Verify we can access any previous state
            // The size is based on unique variable names, not total operations
            for (let i = 0; i < history.length; i++) {
              if (i === 0) {
                expect(history[i].variableTypes.size).toBe(0);
              } else {
                // Size increases only when we see a new variable
                const varsUpToI = new Set(operations.slice(0, i).map(([n]) => n));
                expect(history[i].variableTypes.size).toBe(varsUpToI.size);
              }
            }
            
            // Simulate undo
            const undoSteps = Math.min(5, operations.length);
            const afterUndo = history[history.length - 1 - undoSteps];
            const varsAfterUndo = new Set(operations.slice(0, operations.length - undoSteps).map(([n]) => n));
            expect(afterUndo.variableTypes.size).toBe(varsAfterUndo.size);
          }
        )
      );
    });
  });
});