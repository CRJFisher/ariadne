/**
 * Tests for file tracker functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  create_file_tracker,
  create_file_tracker_impl,
  track_file,
  untrack_file,
  get_tracked_files,
  is_tracked,
  get_file_state,
  should_track_file,
  matches_patterns,
  on_change,
  start_watching,
  stop_watching,
  scan_directory,
  auto_track_files,
  get_stats,
  clear_tracked_files,
  type FileTrackerContext,
  type FileTrackerConfig,
  type FileChangeEvent
} from './file_tracker';

// Mock fs module
vi.mock('fs');

describe('file_tracker', () => {
  let context: FileTrackerContext;
  
  beforeEach(() => {
    const config: FileTrackerConfig = {
      root_path: '/test/project',
      include_patterns: ['**/*.ts', '**/*.js'],
      exclude_patterns: ['**/node_modules/**', '**/*.test.ts']
    };
    
    context = create_file_tracker(config);
    
    // Setup fs mocks
    vi.mocked(fs.statSync).mockImplementation((path) => {
      const mockStats: any = {
        isFile: () => true,
        isDirectory: () => false,
        size: 1000,
        mtimeMs: Date.now()
      };
      
      if (path.toString().includes('missing')) {
        throw new Error('File not found');
      }
      
      return mockStats;
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('create_file_tracker', () => {
    it('should create tracker context with config', () => {
      expect(context.config.root_path).toBe('/test/project');
      expect(context.config.include_patterns).toEqual(['**/*.ts', '**/*.js']);
      expect(context.config.exclude_patterns).toEqual(['**/node_modules/**', '**/*.test.ts']);
      expect(context.tracked_files.size).toBe(0);
      expect(context.file_states.size).toBe(0);
      expect(context.change_listeners.size).toBe(0);
    });
  });
  
  describe('track_file', () => {
    it('should track a file', () => {
      track_file(context, 'main.ts');
      
      expect(context.tracked_files.has('/test/project/main.ts')).toBe(true);
      expect(context.file_states.has('/test/project/main.ts')).toBe(true);
    });
    
    it('should handle absolute paths', () => {
      track_file(context, '/test/project/main.ts');
      
      expect(context.tracked_files.has('/test/project/main.ts')).toBe(true);
    });
    
    it('should not track same file twice', () => {
      track_file(context, 'main.ts');
      track_file(context, 'main.ts');
      
      expect(context.tracked_files.size).toBe(1);
    });
    
    it('should notify listeners when tracking', () => {
      const listener = vi.fn();
      on_change(context, listener);
      
      track_file(context, 'main.ts');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'added',
          file_path: '/test/project/main.ts'
        })
      );
    });
  });
  
  describe('untrack_file', () => {
    beforeEach(() => {
      track_file(context, 'main.ts');
    });
    
    it('should untrack a file', () => {
      untrack_file(context, 'main.ts');
      
      expect(context.tracked_files.has('/test/project/main.ts')).toBe(false);
      expect(context.file_states.has('/test/project/main.ts')).toBe(false);
    });
    
    it('should notify listeners when untracking', () => {
      const listener = vi.fn();
      on_change(context, listener);
      
      untrack_file(context, 'main.ts');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'removed',
          file_path: '/test/project/main.ts'
        })
      );
    });
    
    it('should handle untracking non-tracked file', () => {
      untrack_file(context, 'other.ts');
      
      expect(context.tracked_files.size).toBe(1);
    });
  });
  
  describe('get_tracked_files', () => {
    it('should return all tracked files', () => {
      track_file(context, 'main.ts');
      track_file(context, 'utils.js');
      track_file(context, 'test.ts');
      
      const files = get_tracked_files(context);
      
      expect(files).toHaveLength(3);
      expect(files).toContain('/test/project/main.ts');
      expect(files).toContain('/test/project/utils.js');
      expect(files).toContain('/test/project/test.ts');
    });
    
    it('should return empty array when no files tracked', () => {
      const files = get_tracked_files(context);
      
      expect(files).toEqual([]);
    });
  });
  
  describe('is_tracked', () => {
    beforeEach(() => {
      track_file(context, 'main.ts');
    });
    
    it('should return true for tracked file', () => {
      expect(is_tracked(context, 'main.ts')).toBe(true);
      expect(is_tracked(context, '/test/project/main.ts')).toBe(true);
    });
    
    it('should return false for non-tracked file', () => {
      expect(is_tracked(context, 'other.ts')).toBe(false);
    });
  });
  
  describe('get_file_state', () => {
    it('should return file state for existing file', () => {
      const state = get_file_state(context, 'main.ts');
      
      expect(state.file_path).toBe('/test/project/main.ts');
      expect(state.exists).toBe(true);
      expect(state.size).toBe(1000);
      expect(state.language).toBe('typescript');
      expect(state.is_tracked).toBe(false);
      expect(state.matches_include).toBe(true);
      expect(state.matches_exclude).toBe(false);
    });
    
    it('should return state for missing file', () => {
      const state = get_file_state(context, 'missing.ts');
      
      expect(state.exists).toBe(false);
      expect(state.size).toBe(0);
      expect(state.last_modified).toBe(0);
    });
    
    it('should cache file state', () => {
      get_file_state(context, 'main.ts');
      vi.mocked(fs.statSync).mockClear();
      
      // Second call should use cache
      get_file_state(context, 'main.ts');
      
      expect(fs.statSync).not.toHaveBeenCalled();
    });
  });
  
  describe('matches_patterns', () => {
    it('should match simple wildcards', () => {
      expect(matches_patterns('/project/main.ts', ['*.ts'])).toBe(true);
      expect(matches_patterns('/project/main.ts', ['*.js'])).toBe(false);
    });
    
    it('should match double wildcards', () => {
      expect(matches_patterns('/project/src/main.ts', ['**/*.ts'])).toBe(true);
      expect(matches_patterns('/project/src/deep/main.ts', ['**/*.ts'])).toBe(true);
    });
    
    it('should match any pattern in list', () => {
      expect(matches_patterns('/project/main.ts', ['*.js', '*.ts'])).toBe(true);
    });
    
    it('should return false for empty patterns', () => {
      expect(matches_patterns('/project/main.ts', [])).toBe(false);
    });
  });
  
  describe('should_track_file', () => {
    it('should respect include patterns', () => {
      expect(should_track_file(context, 'main.ts')).toBe(true);
      expect(should_track_file(context, 'utils.js')).toBe(true);
      expect(should_track_file(context, 'readme.md')).toBe(false);
    });
    
    it('should respect exclude patterns', () => {
      expect(should_track_file(context, 'main.test.ts')).toBe(false);
      expect(should_track_file(context, 'node_modules/lib.js')).toBe(false);
    });
    
    it('should prioritize exclude over include', () => {
      expect(should_track_file(context, 'node_modules/index.ts')).toBe(false);
    });
    
    it('should default to true when no patterns', () => {
      const ctx = create_file_tracker({
        root_path: '/test'
      });
      
      expect(should_track_file(ctx, 'any.file')).toBe(true);
    });
  });
  
  describe('on_change', () => {
    it('should register change listener', () => {
      const listener = vi.fn();
      const unsubscribe = on_change(context, listener);
      
      track_file(context, 'main.ts');
      
      expect(listener).toHaveBeenCalled();
      
      // Unsubscribe
      unsubscribe();
      listener.mockClear();
      
      track_file(context, 'other.ts');
      
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('should handle async listeners', async () => {
      const listener = vi.fn().mockResolvedValue(undefined);
      on_change(context, listener);
      
      track_file(context, 'main.ts');
      
      expect(listener).toHaveBeenCalled();
    });
    
    it('should handle listener errors', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();
      
      on_change(context, errorListener);
      on_change(context, goodListener);
      
      // Should not throw
      expect(() => track_file(context, 'main.ts')).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
    });
  });
  
  describe('scan_directory', () => {
    beforeEach(() => {
      vi.mocked(fs.readdirSync).mockImplementation((dir) => {
        if (dir === '/test/project') {
          return [
            { name: 'main.ts', isFile: () => true, isDirectory: () => false },
            { name: 'utils.js', isFile: () => true, isDirectory: () => false },
            { name: 'src', isFile: () => false, isDirectory: () => true },
            { name: 'node_modules', isFile: () => false, isDirectory: () => true },
            { name: 'readme.md', isFile: () => true, isDirectory: () => false }
          ] as any;
        }
        
        if (dir === path.join('/test/project', 'src')) {
          return [
            { name: 'index.ts', isFile: () => true, isDirectory: () => false },
            { name: 'helper.js', isFile: () => true, isDirectory: () => false }
          ] as any;
        }
        
        return [];
      });
    });
    
    it('should scan directory recursively', () => {
      const files = scan_directory(context);
      
      expect(files).toContain('/test/project/main.ts');
      expect(files).toContain('/test/project/utils.js');
      expect(files).toContain(path.join('/test/project', 'src', 'index.ts'));
      expect(files).toContain(path.join('/test/project', 'src', 'helper.js'));
    });
    
    it('should skip excluded directories', () => {
      const files = scan_directory(context);
      
      expect(files).not.toContain(expect.stringContaining('node_modules'));
    });
    
    it('should filter files by patterns', () => {
      const files = scan_directory(context);
      
      expect(files).not.toContain('/test/project/readme.md');
    });
    
    it('should handle scan errors gracefully', () => {
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const files = scan_directory(context);
      
      expect(files).toEqual([]);
    });
  });
  
  describe('auto_track_files', () => {
    beforeEach(() => {
      vi.mocked(fs.readdirSync).mockImplementation((dir) => {
        if (dir === '/test/project') {
          return [
            { name: 'main.ts', isFile: () => true, isDirectory: () => false },
            { name: 'utils.js', isFile: () => true, isDirectory: () => false }
          ] as any;
        }
        return [];
      });
    });
    
    it('should auto-track matching files when enabled', () => {
      context.config.auto_track = true;
      
      const count = auto_track_files(context);
      
      expect(count).toBe(2);
      expect(is_tracked(context, 'main.ts')).toBe(true);
      expect(is_tracked(context, 'utils.js')).toBe(true);
    });
    
    it('should not auto-track when disabled', () => {
      context.config.auto_track = false;
      
      const count = auto_track_files(context);
      
      expect(count).toBe(0);
      expect(context.tracked_files.size).toBe(0);
    });
    
    it('should not re-track already tracked files', () => {
      context.config.auto_track = true;
      track_file(context, 'main.ts');
      
      const count = auto_track_files(context);
      
      expect(count).toBe(1); // Only utils.js
    });
  });
  
  describe('get_stats', () => {
    beforeEach(() => {
      track_file(context, 'main.ts');
      track_file(context, 'utils.js');
      track_file(context, 'test.py');
    });
    
    it('should return tracking statistics', () => {
      const stats = get_stats(context);
      
      expect(stats.total_tracked).toBe(3);
      expect(stats.total_size).toBe(3000); // 3 files * 1000 bytes
      expect(stats.by_language.get('typescript')).toBe(1);
      expect(stats.by_language.get('javascript')).toBe(1);
      expect(stats.by_language.get('python')).toBe(1);
      expect(stats.by_status.existing).toBe(3);
      expect(stats.by_status.missing).toBe(0);
    });
    
    it('should handle missing files', () => {
      track_file(context, 'missing.ts');
      
      const stats = get_stats(context);
      
      expect(stats.total_tracked).toBe(4);
      expect(stats.by_status.existing).toBe(3);
      expect(stats.by_status.missing).toBe(1);
    });
  });
  
  describe('clear_tracked_files', () => {
    it('should clear all tracked files', () => {
      track_file(context, 'main.ts');
      track_file(context, 'utils.js');
      track_file(context, 'test.py');
      
      clear_tracked_files(context);
      
      expect(context.tracked_files.size).toBe(0);
      expect(context.file_states.size).toBe(0);
    });
    
    it('should notify listeners for each file', () => {
      track_file(context, 'main.ts');
      track_file(context, 'utils.js');
      
      const listener = vi.fn();
      on_change(context, listener);
      
      clear_tracked_files(context);
      
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'removed',
          file_path: '/test/project/main.ts'
        })
      );
    });
  });
  
  describe('watching', () => {
    let checkChanges: () => void;
    
    beforeEach(() => {
      vi.useFakeTimers();
      
      // Capture the check function
      const originalSetInterval = setInterval;
      vi.spyOn(global, 'setInterval').mockImplementation((fn: any, ms) => {
        checkChanges = fn;
        return originalSetInterval(fn, ms) as any;
      });
    });
    
    afterEach(() => {
      stop_watching(context);
      vi.useRealTimers();
    });
    
    it('should start polling when watch enabled', () => {
      context.config.watch = true;
      
      start_watching(context);
      
      expect(context.poll_timer).toBeDefined();
    });
    
    it('should not start when watch disabled', () => {
      context.config.watch = false;
      
      start_watching(context);
      
      expect(context.poll_timer).toBeUndefined();
    });
    
    it('should detect file modifications', () => {
      track_file(context, 'main.ts');
      const listener = vi.fn();
      on_change(context, listener);
      
      // Start watching
      context.config.watch = true;
      start_watching(context);
      
      // Simulate file change
      const newTime = Date.now() + 10000;
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 2000,
        mtimeMs: newTime
      } as any);
      
      // Trigger check
      checkChanges();
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'modified',
          file_path: '/test/project/main.ts'
        })
      );
    });
    
    it('should stop watching', () => {
      context.config.watch = true;
      start_watching(context);
      
      stop_watching(context);
      
      expect(context.poll_timer).toBeUndefined();
    });
  });
  
  describe('create_file_tracker_impl', () => {
    it('should create FileTracker interface implementation', () => {
      const tracker = create_file_tracker_impl(context);
      
      tracker.track_file('main.ts');
      expect(tracker.is_tracked('main.ts')).toBe(true);
      
      const files = tracker.get_tracked_files();
      expect(files).toContain('/test/project/main.ts');
      
      tracker.untrack_file('main.ts');
      expect(tracker.is_tracked('main.ts')).toBe(false);
    });
  });
});