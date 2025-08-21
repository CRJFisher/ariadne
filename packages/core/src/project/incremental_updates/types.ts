export interface UpdatePosition {
  row: number;
  column: number;
}

export interface UpdateResult {
  file_path: string;
  source_code: string;
}

export interface IncrementalUpdater {
  update_file(path: string, content: string): UpdateResult;
  update_file_range(
    path: string,
    start: UpdatePosition,
    end: UpdatePosition,
    text: string
  ): UpdateResult;
  get_affected_files(path: string): string[];
}
