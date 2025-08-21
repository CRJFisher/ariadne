import type { StorageInterface, StoredFile } from '../../storage/storage_interface';
import type { IncrementalUpdater, UpdatePosition, UpdateResult } from './types';

export interface IncrementalAdapter {
  update_file(path: string, content: string): Promise<UpdateResult>;
  update_file_range(path: string, start: UpdatePosition, end: UpdatePosition, text: string): Promise<UpdateResult>;
  get_affected_files(path: string): Promise<string[]>;
}

export function create_incremental_adapter(storage: StorageInterface, updater: IncrementalUpdater): IncrementalAdapter {
  return {
    async update_file(path: string, content: string): Promise<UpdateResult> {
      const result = updater.update_file(path, content);
      // TODO: integrate with scope tree + type tracking rebuild for affected file
      const stored: StoredFile = {
        file_path: path,
        source_code: result.source_code,
        // Language detection is centralized elsewhere; leave placeholders
        language: 'javascript' as any,
        last_modified: Date.now(),
      };
      await storage.update_file(stored);
      return result;
    },
    async update_file_range(path: string, start: UpdatePosition, end: UpdatePosition, text: string): Promise<UpdateResult> {
      const result = updater.update_file_range(path, start, end, text);
      const file = await storage.get_file(path);
      const stored: StoredFile = {
        file_path: path,
        source_code: result.source_code,
        language: (file?.language ?? ('javascript' as any)),
        last_modified: Date.now(),
      };
      await storage.update_file(stored);
      return result;
    },
    async get_affected_files(path: string): Promise<string[]> {
      // TODO: compute using module_graph + import_resolution; pass-through for now
      return updater.get_affected_files(path);
    }
  };
}


