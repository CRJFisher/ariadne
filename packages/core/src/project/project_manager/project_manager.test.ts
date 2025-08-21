/**
 * Tests for project manager functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Language } from '@ariadnejs/types';
import {
  initialize_project,
  add_file_to_project,
  remove_file_from_project,
  update_file_in_project,
  get_project_files,
  get_project_file,
  has_project_file,
  get_project_stats,
  batch_update_files,
  clear_project,
  get_files_matching_pattern,
  get_files_by_language,
  type ProjectManagerContext,
  type ProjectConfig,
  type FileChangeEvent,
  type FileTracker,
  type IncrementalUpdateHandler,
  type ModuleGraphBuilder
} from './project_manager';
import { MemoryStorage } from '../../storage/memory_storage/';
import { StoredFile } from '../../storage/storage_interface';

// Mock implementations for testing
class MockFileTracker implements FileTracker {
  private tracked = new Set<string>();
  
  track_file(file_path: string): void {
    this.tracked.add(file_path);
  }
  
  untrack_file(file_path: string): void {
    this.tracked.delete(file_path);
  }
  
  get_tracked_files(): string[] {
    return Array.from(this.tracked);
  }
  
  is_tracked(file_path: string): boolean {
    return this.tracked.has(file_path);
  }
}

class MockUpdateHandler implements IncrementalUpdateHandler {
  private updates: FileChangeEvent[] = [];
  
  async handle_file_change(event: FileChangeEvent): Promise<void> {
    this.updates.push(event);
  }
  
  get_pending_updates(): FileChangeEvent[] {
    return this.updates;
  }
  
  async flush_updates(): Promise<void> {
    this.updates = [];
  }
}

class MockModuleGraph implements ModuleGraphBuilder {
  private modules = new Map<string, string>();
  private deps = new Map<string, Set<string>>();
  
  add_module(file_path: string, content: string): void {
    this.modules.set(file_path, content);
  }
  
  remove_module(file_path: string): void {
    this.modules.delete(file_path);
    this.deps.delete(file_path);
  }
  
  update_module(file_path: string, content: string): void {
    this.modules.set(file_path, content);
  }
  
  get_dependencies(file_path: string): string[] {
    return Array.from(this.deps.get(file_path) || []);
  }
  
  get_dependents(file_path: string): string[] {
    const dependents: string[] = [];
    for (const [module, deps] of Array.from(this.deps)) {
      if (deps.has(file_path)) {
        dependents.push(module);
      }
    }
    return dependents;
  }
}

describe('project_manager', () => {
  let context: ProjectManagerContext;
  let storage: MemoryStorage;
  let file_tracker: MockFileTracker;
  let update_handler: MockUpdateHandler;
  let module_graph: MockModuleGraph;
  
  beforeEach(async () => {
    storage = new MemoryStorage();
    file_tracker = new MockFileTracker();
    update_handler = new MockUpdateHandler();
    module_graph = new MockModuleGraph();
    
    const config: ProjectConfig = {
      root_path: '/test/project',
      primary_language: 'typescript',
      metadata: {
        version: '1.0.0'
      }
    };
    
    context = {
      config,
      storage,
      file_tracker,
      update_handler,
      module_graph
    };
  });
  
  describe('initialize_project', () => {
    it('should initialize empty project', async () => {
      const state = await initialize_project(context);
      
      expect(state.files.size).toBe(0);
      expect(state.metadata.root_path).toBe('/test/project');
      expect(state.metadata.primary_language).toBe('typescript');
      expect(state.metadata.version).toBe('1.0.0');
      expect(state.metadata.created_at).toBeDefined();
    });
    
    it('should preserve existing state', async () => {
      // Initialize once
      await initialize_project(context);
      
      // Add a file
      await add_file_to_project(context, '/test/project/file1.ts', 'content1');
      
      // Re-initialize (simulating restart)
      const state = await initialize_project(context);
      
      expect(state.files.size).toBe(1);
      expect(state.files.has('/test/project/file1.ts')).toBe(true);
    });
  });
  
  describe('add_file_to_project', () => {
    it('should add file to project', async () => {
      await initialize_project(context);
      
      const state = await add_file_to_project(
        context,
        '/test/project/main.ts',
        'console.log("Hello");'
      );
      
      expect(state.files.size).toBe(1);
      expect(state.files.has('/test/project/main.ts')).toBe(true);
      
      const file = state.files.get('/test/project/main.ts');
      expect(file?.source_code).toBe('console.log("Hello");');
      expect(file?.last_modified).toBeDefined();
    });
    
    it('should track file when tracker available', async () => {
      await initialize_project(context);
      
      await add_file_to_project(
        context,
        '/test/project/main.ts',
        'content'
      );
      
      expect(file_tracker.is_tracked('/test/project/main.ts')).toBe(true);
    });
    
    it('should update module graph', async () => {
      await initialize_project(context);
      
      await add_file_to_project(
        context,
        '/test/project/main.ts',
        'import "./utils";'
      );
      
      // Module graph should have the module
      expect(module_graph.get_dependencies('/test/project/main.ts')).toEqual([]);
    });
    
    it('should trigger incremental update', async () => {
      await initialize_project(context);
      
      await add_file_to_project(
        context,
        '/test/project/main.ts',
        'content'
      );
      
      const updates = update_handler.get_pending_updates();
      expect(updates).toHaveLength(1);
      expect(updates[0].type).toBe('added');
      expect(updates[0].file_path).toBe('/test/project/main.ts');
      expect(updates[0].content).toBe('content');
    });
  });
  
  describe('remove_file_from_project', () => {
    it('should remove file from project', async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/main.ts', 'content');
      
      const state = await remove_file_from_project(context, '/test/project/main.ts');
      
      expect(state.files.size).toBe(0);
      expect(state.files.has('/test/project/main.ts')).toBe(false);
    });
    
    it('should untrack file', async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/main.ts', 'content');
      
      await remove_file_from_project(context, '/test/project/main.ts');
      
      expect(file_tracker.is_tracked('/test/project/main.ts')).toBe(false);
    });
    
    it('should trigger removal update', async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/main.ts', 'content');
      await update_handler.flush_updates(); // Clear add event
      
      await remove_file_from_project(context, '/test/project/main.ts');
      
      const updates = update_handler.get_pending_updates();
      expect(updates).toHaveLength(1);
      expect(updates[0].type).toBe('removed');
      expect(updates[0].file_path).toBe('/test/project/main.ts');
      expect(updates[0].old_content).toBe('content');
    });
  });
  
  describe('update_file_in_project', () => {
    it('should update file content', async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/main.ts', 'old content');
      
      const state = await update_file_in_project(
        context,
        '/test/project/main.ts',
        'new content'
      );
      
      const file = state.files.get('/test/project/main.ts');
      expect(file?.source_code).toBe('new content');
    });
    
    it('should preserve language if not provided', async () => {
      await initialize_project(context);
      
      await add_file_to_project(context, '/test/project/main.ts', 'content', 'typescript');
      
      const state = await update_file_in_project(
        context,
        '/test/project/main.ts',
        'new content'
      );
      
      const file = state.files.get('/test/project/main.ts');
      expect(file?.language).toBe('typescript');
    });
    
    it('should trigger modification update', async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/main.ts', 'old content');
      await update_handler.flush_updates();
      
      await update_file_in_project(context, '/test/project/main.ts', 'new content');
      
      const updates = update_handler.get_pending_updates();
      expect(updates).toHaveLength(1);
      expect(updates[0].type).toBe('modified');
      expect(updates[0].old_content).toBe('old content');
      expect(updates[0].content).toBe('new content');
    });
  });
  
  describe('query operations', () => {
    beforeEach(async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/main.ts', 'main content');
      await add_file_to_project(context, '/test/project/utils.js', 'utils content');
      await add_file_to_project(context, '/test/project/test.py', 'test content');
    });
    
    it('should get all project files', async () => {
      const files = await get_project_files(context);
      
      expect(files.size).toBe(3);
      expect(files.has('/test/project/main.ts')).toBe(true);
      expect(files.has('/test/project/utils.js')).toBe(true);
      expect(files.has('/test/project/test.py')).toBe(true);
    });
    
    it('should get specific file', async () => {
      const file = await get_project_file(context, '/test/project/main.ts');
      
      expect(file).toBeDefined();
      expect(file?.source_code).toBe('main content');
    });
    
    it('should check file existence', async () => {
      const exists = await has_project_file(context, '/test/project/main.ts');
      const not_exists = await has_project_file(context, '/test/project/missing.ts');
      
      expect(exists).toBe(true);
      expect(not_exists).toBe(false);
    });
    
    it('should get project statistics', async () => {
      const stats = await get_project_stats(context);
      
      expect(stats.file_count).toBe(3);
      expect(stats.files_by_language.get('typescript')).toBe(1);
      expect(stats.files_by_language.get('javascript')).toBe(1);
      expect(stats.files_by_language.get('python')).toBe(1);
      expect(stats.total_lines).toBe(3); // Each file has 1 line
      expect(stats.total_size).toBeGreaterThan(0);
      expect(stats.last_updated).toBeInstanceOf(Date);
    });
  });
  
  describe('batch_update_files', () => {
    it('should handle multiple changes atomically', async () => {
      await initialize_project(context);
      
      const changes: FileChangeEvent[] = [
        {
          type: 'added',
          file_path: '/test/project/file1.ts',
          content: 'content1',
          timestamp: new Date()
        },
        {
          type: 'added',
          file_path: '/test/project/file2.ts',
          content: 'content2',
          timestamp: new Date()
        },
        {
          type: 'added',
          file_path: '/test/project/file3.ts',
          content: 'content3',
          timestamp: new Date()
        }
      ];
      
      const state = await batch_update_files(context, changes);
      
      expect(state.files.size).toBe(3);
      expect(state.files.has('/test/project/file1.ts')).toBe(true);
      expect(state.files.has('/test/project/file2.ts')).toBe(true);
      expect(state.files.has('/test/project/file3.ts')).toBe(true);
    });
    
    it('should handle mixed operations', async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/existing.ts', 'old');
      
      const changes: FileChangeEvent[] = [
        {
          type: 'added',
          file_path: '/test/project/new.ts',
          content: 'new file',
          timestamp: new Date()
        },
        {
          type: 'modified',
          file_path: '/test/project/existing.ts',
          content: 'updated',
          timestamp: new Date()
        },
        {
          type: 'removed',
          file_path: '/test/project/existing.ts',
          timestamp: new Date()
        }
      ];
      
      const state = await batch_update_files(context, changes);
      
      expect(state.files.size).toBe(1);
      expect(state.files.has('/test/project/new.ts')).toBe(true);
      expect(state.files.has('/test/project/existing.ts')).toBe(false);
    });
  });
  
  describe('utility functions', () => {
    let files: ReadonlyMap<string, StoredFile>;
    
    beforeEach(() => {
      files = new Map([
        ['/project/src/main.ts', { 
          file_path: '/project/src/main.ts', 
          source_code: 'main', 
          language: 'typescript' as Language,
          last_modified: Date.parse('2024-01-01')
        }],
        ['/project/src/utils.ts', { 
          file_path: '/project/src/utils.ts', 
          source_code: 'utils', 
          language: 'typescript' as Language,
          last_modified: Date.parse('2024-01-01')
        }],
        ['/project/test/main.test.ts', { 
          file_path: '/project/test/main.test.ts', 
          source_code: 'test', 
          language: 'typescript' as Language,
          last_modified: Date.parse('2024-01-01')
        }],
        ['/project/scripts/build.js', { 
          file_path: '/project/scripts/build.js', 
          source_code: 'build', 
          language: 'javascript' as Language,
          last_modified: Date.parse('2024-01-01')
        }],
        ['/project/lib/helper.py', { 
          file_path: '/project/lib/helper.py', 
          source_code: 'helper', 
          language: 'python' as Language,
          last_modified: Date.parse('2024-01-01')
        }]
      ]);
    });
    
    it('should find files matching pattern', () => {
      const test_files = get_files_matching_pattern(files, /\.test\./);
      expect(test_files).toHaveLength(1);
      expect(test_files[0].file_path).toBe('/project/test/main.test.ts');
      
      const src_files = get_files_matching_pattern(files, '/src/');
      expect(src_files).toHaveLength(2);
    });
    
    it('should get files by language', () => {
      const ts_files = get_files_by_language(files, 'typescript' as Language);
      expect(ts_files).toHaveLength(3);
      
      const js_files = get_files_by_language(files, 'javascript' as Language);
      expect(js_files).toHaveLength(1);
      expect(js_files[0].file_path).toBe('/project/scripts/build.js');
      
      const py_files = get_files_by_language(files, 'python' as Language);
      expect(py_files).toHaveLength(1);
      expect(py_files[0].file_path).toBe('/project/lib/helper.py');
    });
  });
  
  describe('clear_project', () => {
    it('should remove all files but preserve metadata', async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/file1.ts', 'content1');
      await add_file_to_project(context, '/test/project/file2.ts', 'content2');
      
      const state = await clear_project(context);
      
      expect(state.files.size).toBe(0);
      expect(state.metadata.root_path).toBe('/test/project');
      expect(state.metadata.cleared_at).toBeDefined();
    });
    
    it('should untrack all files', async () => {
      await initialize_project(context);
      await add_file_to_project(context, '/test/project/file1.ts', 'content1');
      await add_file_to_project(context, '/test/project/file2.ts', 'content2');
      
      await clear_project(context);
      
      expect(file_tracker.get_tracked_files()).toHaveLength(0);
    });
  });
});