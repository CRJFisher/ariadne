import { bench, describe } from 'vitest';
import {
  create_file_type_tracker,
  set_variable_type,
  set_imported_class,
  mark_as_exported,
  create_project_type_registry,
  register_export,
  FileTypeTrackerData,
  ProjectTypeRegistryData
} from '../src/call_graph/immutable_type_tracking';
import {
  create_project_call_graph,
  add_file_graph,
  add_file_cache,
  update_file_type_tracker,
  batch_update_files,
  ProjectCallGraphData
} from '../src/call_graph/immutable_project_call_graph';
import { ScopeGraph, Def } from '../src/graph';
import { FileCache } from '../src/file_cache';

// Mock data generators
function createMockGraph(): ScopeGraph {
  const mockRootNode = {
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 100, column: 0 },
    type: 'program',
    children: []
  };
  return new ScopeGraph(mockRootNode as any);
}

function createMockCache(): FileCache {
  return {
    source_code: 'test',
    tree: {} as any,
    language: 'typescript'
  } as FileCache;
}

function createMockDef(id: number, name: string): Def {
  return {
    id,
    kind: 'definition',
    name,
    symbol_kind: 'function',
    symbol_id: `test#${name}`,
    range: { start: { row: id, column: 0 }, end: { row: id, column: 10 } },
    file_path: 'test.ts'
  };
}

describe('Type Tracking Performance', () => {
  bench('set_variable_type - single update', () => {
    const tracker = create_file_type_tracker();
    set_variable_type(tracker, 'var1', {
      className: 'Class1',
      classDef: createMockDef(1, 'Class1'),
      position: { row: 1, column: 0 }
    });
  });

  bench('set_variable_type - 100 sequential updates', () => {
    let tracker = create_file_type_tracker();
    for (let i = 0; i < 100; i++) {
      tracker = set_variable_type(tracker, `var${i}`, {
        className: `Class${i}`,
        classDef: createMockDef(i, `Class${i}`),
        position: { row: i, column: 0 }
      });
    }
  });

  bench('set_variable_type - 1000 sequential updates', () => {
    let tracker = create_file_type_tracker();
    for (let i = 0; i < 1000; i++) {
      tracker = set_variable_type(tracker, `var${i}`, {
        className: `Class${i}`,
        classDef: createMockDef(i, `Class${i}`),
        position: { row: i, column: 0 }
      });
    }
  });

  bench('mark_as_exported - 100 exports', () => {
    let tracker = create_file_type_tracker();
    for (let i = 0; i < 100; i++) {
      tracker = mark_as_exported(tracker, `export${i}`);
    }
  });

  bench('structural sharing benefit - update 1 of 1000 variables', () => {
    // Create tracker with 1000 variables
    let tracker = create_file_type_tracker();
    for (let i = 0; i < 1000; i++) {
      tracker = set_variable_type(tracker, `var${i}`, {
        className: `Class${i}`,
        classDef: createMockDef(i, `Class${i}`),
        position: { row: i, column: 0 }
      });
    }
    
    // Update just one
    set_variable_type(tracker, 'var500', {
      className: 'UpdatedClass',
      classDef: createMockDef(500, 'UpdatedClass'),
      position: { row: 500, column: 0 }
    });
  });
});

describe('Project Registry Performance', () => {
  bench('register_export - single export', () => {
    const registry = create_project_type_registry();
    register_export(
      registry,
      'test.ts',
      'MyExport',
      'MyExport',
      createMockDef(1, 'MyExport')
    );
  });

  bench('register_export - 100 exports', () => {
    let registry = create_project_type_registry();
    for (let i = 0; i < 100; i++) {
      registry = register_export(
        registry,
        `file${i}.ts`,
        `Export${i}`,
        `Export${i}`,
        createMockDef(i, `Export${i}`)
      );
    }
  });
});

describe('Project Call Graph Performance', () => {
  bench('add_file_graph - single file', () => {
    const project = create_project_call_graph();
    add_file_graph(project, 'test.ts', createMockGraph());
  });

  bench('add_file_graph - 100 files sequentially', () => {
    let project = create_project_call_graph();
    for (let i = 0; i < 100; i++) {
      project = add_file_graph(project, `file${i}.ts`, createMockGraph());
    }
  });

  bench('batch_update_files - 100 files at once', () => {
    const project = create_project_call_graph();
    const updates = Array.from({ length: 100 }, (_, i) => ({
      filePath: `file${i}.ts`,
      graph: createMockGraph(),
      cache: createMockCache()
    }));
    
    batch_update_files(project, updates);
  });

  bench('batch vs sequential - 50 files', () => {
    const project = create_project_call_graph();
    
    // Batch update
    const updates = Array.from({ length: 50 }, (_, i) => ({
      filePath: `file${i}.ts`,
      graph: createMockGraph(),
      cache: createMockCache()
    }));
    const batchResult = batch_update_files(project, updates);
    
    // Sequential update
    let seqProject = project;
    for (let i = 0; i < 50; i++) {
      seqProject = add_file_graph(seqProject, `file${i}.ts`, createMockGraph());
      seqProject = add_file_cache(seqProject, `file${i}.ts`, createMockCache());
    }
  });
});

describe('Memory Efficiency', () => {
  bench('structural sharing - minimal copying', () => {
    let project = create_project_call_graph();
    
    // Add 100 files
    for (let i = 0; i < 100; i++) {
      project = add_file_graph(project, `file${i}.ts`, createMockGraph());
    }
    
    // Update just one file - should reuse 99 entries
    add_file_graph(project, 'file50.ts', createMockGraph());
  });

  bench('deep update efficiency', () => {
    let project = create_project_call_graph();
    
    // Build complex project
    for (let i = 0; i < 50; i++) {
      project = add_file_graph(project, `file${i}.ts`, createMockGraph());
      project = add_file_cache(project, `file${i}.ts`, createMockCache());
      
      let tracker = create_file_type_tracker();
      for (let j = 0; j < 20; j++) {
        tracker = set_variable_type(tracker, `var${j}`, {
          className: `Class${j}`,
          classDef: createMockDef(j, `Class${j}`),
          position: { row: j, column: 0 }
        });
      }
      project = update_file_type_tracker(project, `file${i}.ts`, tracker);
    }
    
    // Single deep update
    const tracker = project.fileTypeTrackers.get('file25.ts')!;
    const updated = set_variable_type(tracker, 'newVar', {
      className: 'NewClass',
      classDef: createMockDef(999, 'NewClass'),
      position: { row: 999, column: 0 }
    });
    update_file_type_tracker(project, 'file25.ts', updated);
  });
});

describe('Real-world Scenarios', () => {
  bench('typical file analysis', () => {
    let project = create_project_call_graph();
    const filePath = 'src/components/Button.tsx';
    
    // Add file to project
    project = add_file_graph(project, filePath, createMockGraph());
    project = add_file_cache(project, filePath, createMockCache());
    
    // Track types
    let tracker = create_file_type_tracker();
    
    // Simulate imports
    tracker = set_imported_class(tracker, 'React', {
      className: 'React',
      classDef: createMockDef(1, 'React'),
      sourceFile: 'react'
    });
    
    // Simulate variable types
    tracker = set_variable_type(tracker, 'props', {
      className: 'ButtonProps',
      classDef: createMockDef(2, 'ButtonProps'),
      position: { row: 10, column: 0 }
    });
    
    // Mark exports
    tracker = mark_as_exported(tracker, 'Button');
    
    // Update project
    project = update_file_type_tracker(project, filePath, tracker);
    
    // Register in project registry
    let registry = project.projectTypeRegistry;
    registry = register_export(
      registry,
      filePath,
      'Button',
      'Button',
      createMockDef(3, 'Button')
    );
    project = update_project_registry(project, registry);
  });

  bench('large project update cycle', () => {
    let project = create_project_call_graph();
    
    // Simulate 500 file project
    const updates = [];
    for (let i = 0; i < 500; i++) {
      const tracker = create_file_type_tracker();
      updates.push({
        filePath: `src/file${i}.ts`,
        graph: createMockGraph(),
        cache: createMockCache(),
        typeTracker: tracker
      });
    }
    
    project = batch_update_files(project, updates);
    
    // Simulate incremental update to 10 files
    const incrementalUpdates = [];
    for (let i = 100; i < 110; i++) {
      incrementalUpdates.push({
        filePath: `src/file${i}.ts`,
        graph: createMockGraph(),
        cache: createMockCache()
      });
    }
    
    batch_update_files(project, incrementalUpdates);
  });
});