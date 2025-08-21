export interface UpdatePosition { row: number; column: number }

export interface UpdateResult {
  file_path: string;
  source_code: string;
}

export interface IncrementalUpdater {
  update_file(path: string, content: string): UpdateResult;
  update_file_range(path: string, start: UpdatePosition, end: UpdatePosition, text: string): UpdateResult;
  get_affected_files(path: string): string[];
}

export function create_incremental_updater(): IncrementalUpdater {
  // TODO: Wire to storage and scope tree for real incremental parsing
  const files = new Map<string, string>();

  const apply_range = (original: string, start: UpdatePosition, end: UpdatePosition, text: string): string => {
    const lines = original.split("\n");
    const before = lines.slice(0, start.row).join("\n") + (start.row > 0 ? "\n" : "") + lines[start.row].slice(0, start.column);
    const after_line = lines[end.row] ?? "";
    const after = after_line.slice(end.column) + (end.row + 1 < lines.length ? "\n" + lines.slice(end.row + 1).join("\n") : "");
    return before + text + after;
  };

  return {
    update_file(path: string, content: string): UpdateResult {
      files.set(path, content);
      return { file_path: path, source_code: content };
    },
    update_file_range(path: string, start: UpdatePosition, end: UpdatePosition, text: string): UpdateResult {
      const current = files.get(path) ?? "";
      const updated = apply_range(current, start, end, text);
      files.set(path, updated);
      return { file_path: path, source_code: updated };
    },
    get_affected_files(path: string): string[] {
      // TODO: Compute dependencies; for now return the file itself
      return files.has(path) ? [path] : [];
    }
  };
}


