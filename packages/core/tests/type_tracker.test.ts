import { describe, it, expect } from 'vitest';
import {
  create_file_type_tracker,
  set_variable_type,
  get_variable_type,
  set_imported_class,
  get_imported_class,
  mark_as_exported,
  is_exported,
  get_exported_definitions,
  clear_file_type_tracker,
  create_local_type_tracker,
  set_local_variable_type,
  get_local_variable_type,
  get_local_imported_class,
  create_project_type_registry,
  register_export,
  get_imported_type,
  clear_file_exports,
  set_variable_types,
  set_imported_classes,
  mark_as_exported_batch,
  register_exports,
  FileTypeTrackerData,
  LocalTypeTrackerData,
  ProjectTypeRegistryData
} from '../src/call_graph/type_tracker';
import { TypeInfo, ImportedClassInfo } from '../src/call_graph/types';
import { Def } from '../src/graph';
import {
  variable_symbol,
  class_symbol,
  function_symbol,
  symbol_from_string
} from '@ariadnejs/types';

describe('Immutable Type Tracking', () => {
  describe('FileTypeTracker', () => {
    it('should create an empty tracker', () => {
      const tracker = create_file_type_tracker();
      expect(tracker.variableTypes.size).toBe(0);
      expect(tracker.importedClasses.size).toBe(0);
      expect(tracker.exportedDefinitions.size).toBe(0);
    });

    it('should return new instance when setting variable type', () => {
      const tracker1 = create_file_type_tracker();
      const var_symbol = variable_symbol('myVar', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 1,
        end_column: 5
      });
      const class_symbol = class_symbol('MyClass', 'test.ts', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 1,
        end_column: 7
      });
      const type_info: TypeInfo = {
        type: 'class',
        className: symbol_from_string(class_symbol).name,
        position: { row: 1, column: 0 }
      };

      const tracker2 = set_variable_type(tracker1, symbol_from_string(var_symbol).name, type_info);

      // Original tracker unchanged
      expect(tracker1.variableTypes.size).toBe(0);
      expect(tracker1).not.toBe(tracker2);

      // New tracker has the update
      expect(tracker2.variableTypes.size).toBe(1);
      expect(get_variable_type(tracker2, symbol_from_string(var_symbol).name)).toEqual(type_info);
    });

    it('should maintain immutability through multiple operations', () => {
      const tracker1 = create_file_type_tracker();
      const var1Symbol = variable_symbol('var1', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 1,
        end_column: 4
      });
      const var2Symbol = variable_symbol('var2', {
        file_path: 'test.ts',
        line: 2,
        column: 0,
        end_line: 2,
        end_column: 4
      });
      const class1Symbol = class_symbol('Class1', 'test.ts', {
        file_path: 'test.ts',
        line: 1,
        column: 0,
        end_line: 1,
        end_column: 6
      });
      const class2Symbol = class_symbol('Class2', 'test.ts', {
        file_path: 'test.ts',
        line: 2,
        column: 0,
        end_line: 2,
        end_column: 6
      });
      const type1: TypeInfo = { type: 'class', className: symbol_from_string(class1Symbol).name, position: { row: 1, column: 0 } };
      const type2: TypeInfo = { type: 'class', className: symbol_from_string(class2Symbol).name, position: { row: 2, column: 0 } };
      
      const tracker2 = set_variable_type(tracker1, symbol_from_string(var1Symbol).name, type1);
      const tracker3 = set_variable_type(tracker2, symbol_from_string(var2Symbol).name, type2);
      
      // Each tracker maintains its state
      expect(tracker1.variableTypes.size).toBe(0);
      expect(tracker2.variableTypes.size).toBe(1);
      expect(tracker3.variableTypes.size).toBe(2);
      
      // All are different instances
      expect(tracker1).not.toBe(tracker2);
      expect(tracker2).not.toBe(tracker3);
      expect(tracker1).not.toBe(tracker3);
    });

    it('should handle position-aware type lookups', () => {
      let tracker = create_file_type_tracker();
      const type1: TypeInfo = { type: 'class', className: 'String', position: { row: 1, column: 0 } };
      const type2: TypeInfo = { type: 'class', className: 'Number', position: { row: 5, column: 0 } };
      
      tracker = set_variable_type(tracker, 'myVar', type1);
      tracker = set_variable_type(tracker, 'myVar', type2);
      
      // Before reassignment
      expect(get_variable_type(tracker, 'myVar', { row: 3, column: 0 })).toEqual(type1);
      
      // After reassignment
      expect(get_variable_type(tracker, 'myVar', { row: 7, column: 0 })).toEqual(type2);
      
      // No position = latest
      expect(get_variable_type(tracker, 'myVar')).toEqual(type2);
    });

    it('should handle imported classes immutably', () => {
      const tracker1 = create_file_type_tracker();
      const classInfo: ImportedClassInfo = {
        className: 'MyClass',
        importedFrom: './myclass',
        originalName: 'MyClass'
      };
      
      const tracker2 = set_imported_class(tracker1, 'MyClass', classInfo);
      
      expect(tracker1.importedClasses.size).toBe(0);
      expect(tracker2.importedClasses.size).toBe(1);
      expect(get_imported_class(tracker2, 'MyClass')).toEqual(classInfo);
    });

    it('should handle exported definitions immutably', () => {
      const tracker1 = create_file_type_tracker();
      const tracker2 = mark_as_exported(tracker1, 'myFunction');
      
      expect(tracker1.exportedDefinitions.size).toBe(0);
      expect(tracker2.exportedDefinitions.size).toBe(1);
      expect(is_exported(tracker2, 'myFunction')).toBe(true);
      expect(is_exported(tracker1, 'myFunction')).toBe(false);
    });

    it('should clear tracker immutably', () => {
      let tracker = create_file_type_tracker();
      tracker = set_variable_type(tracker, 'var1', { type: 'class', className: 'Test', position: { row: 1, column: 0 } });
      tracker = mark_as_exported(tracker, 'func1');
      
      const originalSize = tracker.variableTypes.size;
      const clearedTracker = clear_file_type_tracker(tracker);
      
      // Original unchanged
      expect(tracker.variableTypes.size).toBe(originalSize);
      
      // New tracker is empty
      expect(clearedTracker.variableTypes.size).toBe(0);
      expect(clearedTracker.exportedDefinitions.size).toBe(0);
    });
  });

  describe('LocalTypeTracker', () => {
    it('should create local tracker with parent', () => {
      const parent = create_file_type_tracker();
      const local = create_local_type_tracker(parent);
      
      expect(local.localTypes.size).toBe(0);
      expect(local.parent).toBe(parent);
    });

    it('should maintain immutability in local scope', () => {
      const parent = create_file_type_tracker();
      const local1 = create_local_type_tracker(parent);
      const typeInfo: TypeInfo = { type: 'class', className: 'LocalClass', position: { row: 1, column: 0 } };
      
      const local2 = set_local_variable_type(local1, 'localVar', typeInfo);
      
      // Original unchanged
      expect(local1.localTypes.size).toBe(0);
      expect(local1).not.toBe(local2);
      
      // New instance has update
      expect(local2.localTypes.size).toBe(1);
      expect(get_local_variable_type(local2, 'localVar')).toEqual(typeInfo);
    });

    it('should fallback to parent for variable types', () => {
      let parent = create_file_type_tracker();
      const parentType: TypeInfo = { type: 'class', className: 'ParentClass', position: { row: 1, column: 0 } };
      parent = set_variable_type(parent, 'parentVar', parentType);
      
      const local = create_local_type_tracker(parent);
      
      // Should find parent's variable
      expect(get_local_variable_type(local, 'parentVar')).toEqual(parentType);
    });

    it('should override parent types with local types', () => {
      let parent = create_file_type_tracker();
      const parentType: TypeInfo = { type: 'class', className: 'ParentClass', position: { row: 1, column: 0 } };
      parent = set_variable_type(parent, 'sharedVar', parentType);
      
      let local = create_local_type_tracker(parent);
      const localType: TypeInfo = { type: 'class', className: 'LocalClass', position: { row: 5, column: 0 } };
      local = set_local_variable_type(local, 'sharedVar', localType);
      
      // Local type takes precedence
      expect(get_local_variable_type(local, 'sharedVar')).toEqual(localType);
    });

    it('should access imported classes from parent', () => {
      let parent = create_file_type_tracker();
      const classInfo: ImportedClassInfo = {
        className: 'ImportedClass',
        importedFrom: './imported',
        originalName: 'ImportedClass'
      };
      parent = set_imported_class(parent, 'ImportedClass', classInfo);
      
      const local = create_local_type_tracker(parent);
      
      expect(get_local_imported_class(local, 'ImportedClass')).toEqual(classInfo);
    });
  });

  describe('ProjectTypeRegistry', () => {
    it('should create empty registry', () => {
      const registry = create_project_type_registry();
      expect(registry.exportedTypes.size).toBe(0);
      expect(registry.fileExports.size).toBe(0);
    });

    it('should register exports immutably', () => {
      const registry1 = create_project_type_registry();
      const classDef: Def = {
        name: 'MyClass',
        start: { row: 1, column: 0 },
        end: { row: 10, column: 0 },
        kind: 'class'
      };
      
      const registry2 = register_export(registry1, 'src/myfile.ts', 'MyClass', 'MyClass', classDef);
      
      // Original unchanged
      expect(registry1.exportedTypes.size).toBe(0);
      expect(registry1.fileExports.size).toBe(0);
      
      // New registry has export
      expect(registry2.exportedTypes.size).toBe(1);
      expect(registry2.fileExports.size).toBe(1);
      expect(get_imported_type(registry2, 'src/myfile.ts', 'MyClass')).toBeDefined();
    });

    it('should clear file exports immutably', () => {
      let registry = create_project_type_registry();
      const classDef: Def = {
        name: 'MyClass',
        start: { row: 1, column: 0 },
        end: { row: 10, column: 0 },
        kind: 'class'
      };
      
      registry = register_export(registry, 'src/file1.ts', 'Class1', 'Class1', classDef);
      registry = register_export(registry, 'src/file1.ts', 'Class2', 'Class2', classDef);
      registry = register_export(registry, 'src/file2.ts', 'Class3', 'Class3', classDef);
      
      const originalSize = registry.exportedTypes.size;
      const clearedRegistry = clear_file_exports(registry, 'src/file1.ts');
      
      // Original unchanged
      expect(registry.exportedTypes.size).toBe(originalSize);
      
      // New registry has file1 exports removed
      expect(clearedRegistry.exportedTypes.size).toBe(1);
      expect(get_imported_type(clearedRegistry, 'src/file1.ts', 'Class1')).toBeUndefined();
      expect(get_imported_type(clearedRegistry, 'src/file1.ts', 'Class2')).toBeUndefined();
      expect(get_imported_type(clearedRegistry, 'src/file2.ts', 'Class3')).toBeDefined();
    });
  });

  describe('Batch operations', () => {
    it('should apply multiple variable type updates', () => {
      const tracker1 = create_file_type_tracker();
      const updates = [
        { varName: 'var1', typeInfo: { type: 'class' as const, className: 'Class1', position: { row: 1, column: 0 } } },
        { varName: 'var2', typeInfo: { type: 'class' as const, className: 'Class2', position: { row: 2, column: 0 } } },
        { varName: 'var3', typeInfo: { type: 'class' as const, className: 'Class3', position: { row: 3, column: 0 } } }
      ];
      
      const tracker2 = set_variable_types(tracker1, updates);
      
      expect(tracker1.variableTypes.size).toBe(0);
      expect(tracker2.variableTypes.size).toBe(3);
      expect(get_variable_type(tracker2, 'var1')?.className).toBe('Class1');
      expect(get_variable_type(tracker2, 'var2')?.className).toBe('Class2');
      expect(get_variable_type(tracker2, 'var3')?.className).toBe('Class3');
    });

    it('should mark multiple exports in batch', () => {
      const tracker1 = create_file_type_tracker();
      const tracker2 = mark_as_exported_batch(tracker1, ['func1', 'func2', 'func3']);
      
      expect(tracker1.exportedDefinitions.size).toBe(0);
      expect(tracker2.exportedDefinitions.size).toBe(3);
      expect(is_exported(tracker2, 'func1')).toBe(true);
      expect(is_exported(tracker2, 'func2')).toBe(true);
      expect(is_exported(tracker2, 'func3')).toBe(true);
    });

    it('should register multiple exports in batch', () => {
      const registry1 = create_project_type_registry();
      const classDef: Def = {
        name: 'Class',
        start: { row: 1, column: 0 },
        end: { row: 10, column: 0 },
        kind: 'class'
      };
      
      const exports = [
        { file_path: 'src/file1.ts', exportName: 'Class1', className: 'Class1', classDef },
        { file_path: 'src/file2.ts', exportName: 'Class2', className: 'Class2', classDef },
        { file_path: 'src/file3.ts', exportName: 'Class3', className: 'Class3', classDef }
      ];
      
      const registry2 = register_exports(registry1, exports);
      
      expect(registry1.exportedTypes.size).toBe(0);
      expect(registry2.exportedTypes.size).toBe(3);
      expect(get_imported_type(registry2, 'src/file1.ts', 'Class1')).toBeDefined();
      expect(get_imported_type(registry2, 'src/file2.ts', 'Class2')).toBeDefined();
      expect(get_imported_type(registry2, 'src/file3.ts', 'Class3')).toBeDefined();
    });
  });

  describe('Type safety', () => {
    it('should use readonly types to prevent mutations at compile time', () => {
      const tracker = create_file_type_tracker();
      
      // The types are marked as readonly in TypeScript, which prevents
      // mutations at compile time. At runtime, we verify the immutability
      // by checking that operations return new instances.
      
      // Verify immutability by checking references
      const original = tracker;
      const modified = set_variable_type(tracker, 'test', {
        type: 'class',
        className: 'Test',
        position: { row: 1, column: 0 }
      });
      
      expect(original).not.toBe(modified);
      expect(original.variableTypes.size).toBe(0);
      expect(modified.variableTypes.size).toBe(1);
    });
  });
});