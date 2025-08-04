import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProjectCallGraphData,
  create_project_call_graph,
  add_file_graph,
  add_file_cache,
  update_file_type_tracker,
  update_project_registry,
  get_or_create_file_type_tracker,
  clear_file_data,
  batch_update_files,
  merge_project_graphs,
  get_all_file_paths,
  has_file,
  get_file_data,
  create_updater,
  FileUpdate
} from '../src/call_graph/immutable_project_call_graph';
import { 
  create_file_type_tracker,
  create_project_type_registry,
  set_variable_type
} from '../src/call_graph/immutable_type_tracking';
import { ScopeGraph } from '../src/graph';
import { FileCache } from '../src/file_cache';
import { LanguageConfig } from '../src/types';

// Mock implementations
function createMockGraph(): ScopeGraph {
  const mockRootNode = {
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 100, column: 0 },
    type: 'program',
    children: []
  };
  return new ScopeGraph(mockRootNode as any);
}

function createMockFileCache(content: string = ''): FileCache {
  return {
    source_code: content,
    tree: {} as any,
    language: 'typescript'
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

describe('Immutable Project Call Graph', () => {
  let project: ProjectCallGraphData;
  let mockGraph: ScopeGraph;
  let mockCache: FileCache;
  let mockLanguage: LanguageConfig;

  beforeEach(() => {
    const languages = new Map([['typescript', createMockLanguageConfig()]]);
    project = create_project_call_graph(languages);
    mockGraph = createMockGraph();
    mockCache = createMockFileCache('test content');
    mockLanguage = createMockLanguageConfig();
  });

  describe('create_project_call_graph', () => {
    it('should create empty project with default values', () => {
      const emptyProject = create_project_call_graph();
      
      expect(emptyProject.fileGraphs.size).toBe(0);
      expect(emptyProject.fileCache.size).toBe(0);
      expect(emptyProject.languages.size).toBe(0);
      expect(emptyProject.fileTypeTrackers.size).toBe(0);
      expect(emptyProject.projectTypeRegistry).toBeDefined();
    });

    it('should create project with provided languages', () => {
      const langs = new Map([
        ['typescript', mockLanguage],
        ['javascript', { ...mockLanguage, language: 'javascript' }]
      ]);
      const projectWithLangs = create_project_call_graph(langs);
      
      expect(projectWithLangs.languages.size).toBe(2);
      expect(projectWithLangs.languages.get('typescript')).toBeDefined();
      expect(projectWithLangs.languages.get('javascript')).toBeDefined();
    });
  });

  describe('add_file_graph', () => {
    it('should add new file graph immutably', () => {
      const newProject = add_file_graph(project, 'test.ts', mockGraph);
      
      // Original unchanged
      expect(project.fileGraphs.size).toBe(0);
      expect(project.fileGraphs.has('test.ts')).toBe(false);
      
      // New project has the graph
      expect(newProject.fileGraphs.size).toBe(1);
      expect(newProject.fileGraphs.get('test.ts')).toBe(mockGraph);
      
      // Other properties unchanged
      expect(newProject.fileCache).toBe(project.fileCache);
      expect(newProject.languages).toBe(project.languages);
      expect(newProject.fileTypeTrackers).toBe(project.fileTypeTrackers);
      expect(newProject.projectTypeRegistry).toBe(project.projectTypeRegistry);
    });

    it('should update existing file graph', () => {
      const project1 = add_file_graph(project, 'test.ts', mockGraph);
      const newGraph = createMockGraph();
      const project2 = add_file_graph(project1, 'test.ts', newGraph);
      
      expect(project1.fileGraphs.get('test.ts')).toBe(mockGraph);
      expect(project2.fileGraphs.get('test.ts')).toBe(newGraph);
      expect(project2.fileGraphs.size).toBe(1);
    });
  });

  describe('add_file_cache', () => {
    it('should add file cache immutably', () => {
      const newProject = add_file_cache(project, 'test.ts', mockCache);
      
      // Original unchanged
      expect(project.fileCache.size).toBe(0);
      
      // New project has the cache
      expect(newProject.fileCache.size).toBe(1);
      expect(newProject.fileCache.get('test.ts')).toBe(mockCache);
      
      // Structural sharing for other maps
      expect(newProject.fileGraphs).toBe(project.fileGraphs);
    });
  });

  describe('update_file_type_tracker', () => {
    it('should update type tracker immutably', () => {
      const tracker = create_file_type_tracker();
      const updatedTracker = set_variable_type(tracker, 'myVar', {
        className: 'MyClass',
        classDef: {} as any,
        position: { row: 1, column: 0 }
      });
      
      const newProject = update_file_type_tracker(project, 'test.ts', updatedTracker);
      
      expect(project.fileTypeTrackers.size).toBe(0);
      expect(newProject.fileTypeTrackers.size).toBe(1);
      expect(newProject.fileTypeTrackers.get('test.ts')).toBe(updatedTracker);
    });
  });

  describe('update_project_registry', () => {
    it('should update registry immutably', () => {
      const newRegistry = create_project_type_registry();
      const newProject = update_project_registry(project, newRegistry);
      
      expect(newProject.projectTypeRegistry).toBe(newRegistry);
      expect(newProject.projectTypeRegistry).not.toBe(project.projectTypeRegistry);
      
      // Other properties unchanged via structural sharing
      expect(newProject.fileGraphs).toBe(project.fileGraphs);
      expect(newProject.fileCache).toBe(project.fileCache);
    });
  });

  describe('get_or_create_file_type_tracker', () => {
    it('should return existing tracker if present', () => {
      const tracker = create_file_type_tracker();
      const projectWithTracker = update_file_type_tracker(project, 'test.ts', tracker);
      
      const result = get_or_create_file_type_tracker(projectWithTracker, 'test.ts');
      expect(result).toBe(tracker);
    });

    it('should create new tracker if not present', () => {
      const result = get_or_create_file_type_tracker(project, 'test.ts');
      expect(result).toBeDefined();
      expect(result.variableTypes).toBeDefined();
      expect(result.variableTypes.size).toBe(0);
      expect(result.importedClasses).toBeDefined();
      expect(result.importedClasses.size).toBe(0);
      expect(result.exportedDefinitions).toBeDefined();
      expect(result.exportedDefinitions.size).toBe(0);
    });
  });

  describe('clear_file_data', () => {
    it('should remove all data for a file', () => {
      // Add data for multiple files
      let newProject = add_file_graph(project, 'test1.ts', mockGraph);
      newProject = add_file_graph(newProject, 'test2.ts', createMockGraph());
      newProject = add_file_cache(newProject, 'test1.ts', mockCache);
      newProject = add_file_cache(newProject, 'test2.ts', createMockFileCache());
      newProject = update_file_type_tracker(newProject, 'test1.ts', create_file_type_tracker());
      
      expect(newProject.fileGraphs.size).toBe(2);
      expect(newProject.fileCache.size).toBe(2);
      expect(newProject.fileTypeTrackers.size).toBe(1);
      
      // Clear one file
      const clearedProject = clear_file_data(newProject, 'test1.ts');
      
      expect(clearedProject.fileGraphs.size).toBe(1);
      expect(clearedProject.fileGraphs.has('test1.ts')).toBe(false);
      expect(clearedProject.fileGraphs.has('test2.ts')).toBe(true);
      
      expect(clearedProject.fileCache.size).toBe(1);
      expect(clearedProject.fileCache.has('test1.ts')).toBe(false);
      expect(clearedProject.fileCache.has('test2.ts')).toBe(true);
      
      expect(clearedProject.fileTypeTrackers.size).toBe(0);
    });
  });

  describe('batch_update_files', () => {
    it('should handle empty updates', () => {
      const result = batch_update_files(project, []);
      expect(result).toBe(project); // Same reference for no changes
    });

    it('should update multiple files at once', () => {
      const updates: FileUpdate[] = [
        {
          filePath: 'file1.ts',
          graph: mockGraph,
          cache: mockCache
        },
        {
          filePath: 'file2.ts',
          graph: createMockGraph(),
          typeTracker: create_file_type_tracker()
        }
      ];
      
      const newProject = batch_update_files(project, updates);
      
      expect(newProject.fileGraphs.size).toBe(2);
      expect(newProject.fileCache.size).toBe(1);
      expect(newProject.fileTypeTrackers.size).toBe(1);
      
      expect(newProject.fileGraphs.get('file1.ts')).toBe(mockGraph);
      expect(newProject.fileCache.get('file1.ts')).toBe(mockCache);
      expect(newProject.fileTypeTrackers.has('file2.ts')).toBe(true);
    });

    it('should handle partial updates', () => {
      // Start with existing data
      let existingProject = add_file_graph(project, 'file1.ts', mockGraph);
      existingProject = add_file_cache(existingProject, 'file1.ts', mockCache);
      
      // Update only the cache
      const newCache = createMockFileCache('new content');
      const updates: FileUpdate[] = [{
        filePath: 'file1.ts',
        cache: newCache
      }];
      
      const newProject = batch_update_files(existingProject, updates);
      
      expect(newProject.fileGraphs.get('file1.ts')).toBe(mockGraph); // Unchanged
      expect(newProject.fileCache.get('file1.ts')).toBe(newCache); // Updated
    });
  });

  describe('merge_project_graphs', () => {
    it('should merge with project2 taking precedence', () => {
      // Create two projects with overlapping data
      let project1 = add_file_graph(project, 'shared.ts', mockGraph);
      project1 = add_file_graph(project1, 'only1.ts', createMockGraph());
      project1 = add_file_cache(project1, 'shared.ts', mockCache);
      
      const newGraph = createMockGraph();
      const newCache = createMockFileCache('project2 content');
      let project2 = create_project_call_graph();
      project2 = add_file_graph(project2, 'shared.ts', newGraph);
      project2 = add_file_graph(project2, 'only2.ts', createMockGraph());
      project2 = add_file_cache(project2, 'shared.ts', newCache);
      
      const merged = merge_project_graphs(project1, project2);
      
      // Check merged results
      expect(merged.fileGraphs.size).toBe(3);
      expect(merged.fileGraphs.has('only1.ts')).toBe(true);
      expect(merged.fileGraphs.has('only2.ts')).toBe(true);
      expect(merged.fileGraphs.get('shared.ts')).toBe(newGraph); // project2 wins
      
      expect(merged.fileCache.size).toBe(1);
      expect(merged.fileCache.get('shared.ts')).toBe(newCache); // project2 wins
      
      expect(merged.projectTypeRegistry).toBe(project2.projectTypeRegistry);
    });
  });

  describe('get_all_file_paths', () => {
    it('should return unique paths from graphs and cache', () => {
      let newProject = add_file_graph(project, 'file1.ts', mockGraph);
      newProject = add_file_graph(newProject, 'file2.ts', createMockGraph());
      newProject = add_file_cache(newProject, 'file2.ts', mockCache);
      newProject = add_file_cache(newProject, 'file3.ts', createMockFileCache());
      
      const paths = get_all_file_paths(newProject);
      
      expect(paths).toHaveLength(3);
      expect(paths).toContain('file1.ts');
      expect(paths).toContain('file2.ts');
      expect(paths).toContain('file3.ts');
    });
  });

  describe('has_file', () => {
    it('should check both graphs and cache', () => {
      let newProject = add_file_graph(project, 'graph-only.ts', mockGraph);
      newProject = add_file_cache(newProject, 'cache-only.ts', mockCache);
      
      expect(has_file(newProject, 'graph-only.ts')).toBe(true);
      expect(has_file(newProject, 'cache-only.ts')).toBe(true);
      expect(has_file(newProject, 'not-exists.ts')).toBe(false);
    });
  });

  describe('get_file_data', () => {
    it('should return all available data for a file', () => {
      const tracker = create_file_type_tracker();
      let newProject = add_file_graph(project, 'test.ts', mockGraph);
      newProject = add_file_cache(newProject, 'test.ts', mockCache);
      newProject = update_file_type_tracker(newProject, 'test.ts', tracker);
      
      const data = get_file_data(newProject, 'test.ts');
      
      expect(data).toBeDefined();
      expect(data!.graph).toBe(mockGraph);
      expect(data!.cache).toBe(mockCache);
      expect(data!.typeTracker).toBe(tracker);
    });

    it('should return partial data if not all present', () => {
      const newProject = add_file_graph(project, 'test.ts', mockGraph);
      
      const data = get_file_data(newProject, 'test.ts');
      
      expect(data).toBeDefined();
      expect(data!.graph).toBe(mockGraph);
      expect(data!.cache).toBeUndefined();
      expect(data!.typeTracker).toBeUndefined();
    });

    it('should return undefined for non-existent file', () => {
      const data = get_file_data(project, 'not-exists.ts');
      expect(data).toBeUndefined();
    });
  });

  describe('ProjectCallGraphUpdater', () => {
    it('should support builder pattern updates', () => {
      const updater = create_updater(project);
      
      const newProject = updater
        .addFileGraph('file1.ts', mockGraph)
        .addFileCache('file1.ts', mockCache)
        .addFileGraph('file2.ts', createMockGraph())
        .updateFileTypeTracker('file1.ts', create_file_type_tracker())
        .build();
      
      expect(newProject.fileGraphs.size).toBe(2);
      expect(newProject.fileCache.size).toBe(1);
      expect(newProject.fileTypeTrackers.size).toBe(1);
    });

    it('should maintain immutability through builder', () => {
      const updater = create_updater(project);
      const intermediate = updater.addFileGraph('test.ts', mockGraph);
      
      // Original project unchanged
      expect(project.fileGraphs.size).toBe(0);
      
      // Can continue building
      const final = intermediate
        .addFileCache('test.ts', mockCache)
        .build();
      
      expect(final.fileGraphs.size).toBe(1);
      expect(final.fileCache.size).toBe(1);
    });

    it('should reuse unchanged collections', () => {
      const updater = create_updater(project);
      
      // Only update file graphs
      const newProject = updater
        .addFileGraph('test.ts', mockGraph)
        .build();
      
      // Other collections should be the same reference
      expect(newProject.fileCache).toBe(project.fileCache);
      expect(newProject.languages).toBe(project.languages);
      expect(newProject.fileTypeTrackers).toBe(project.fileTypeTrackers);
    });
  });

  describe('Immutability verification', () => {
    it('should verify immutability through new instance creation', () => {
      const newProject = add_file_graph(project, 'test.ts', mockGraph);
      
      // Verify that operations return new instances
      const anotherProject = add_file_graph(newProject, 'another.ts', createMockGraph());
      
      // Original project unchanged
      expect(newProject.fileGraphs.size).toBe(1);
      expect(newProject.fileGraphs.has('another.ts')).toBe(false);
      
      // New project has both
      expect(anotherProject.fileGraphs.size).toBe(2);
      expect(anotherProject.fileGraphs.has('test.ts')).toBe(true);
      expect(anotherProject.fileGraphs.has('another.ts')).toBe(true);
    });

    it('should maintain referential transparency', () => {
      const project1 = add_file_graph(project, 'test.ts', mockGraph);
      const project2 = add_file_graph(project, 'test.ts', mockGraph);
      
      // Same inputs produce equivalent outputs
      expect(project1.fileGraphs.size).toBe(project2.fileGraphs.size);
      expect(project1.fileGraphs.get('test.ts')).toBe(project2.fileGraphs.get('test.ts'));
    });
  });
});