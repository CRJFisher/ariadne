/**
 * Project - In-memory code project management
 *
 * Provides a high-level API for managing a collection of files
 * and performing code analysis operations on them.
 */

// Minimal implementation to fix import errors
// TODO: Implement full semantic indexing once TypeScript issues are resolved

/**
 * Represents a code project with multiple files
 * Minimal implementation to enable MCP tests
 */
export class Project {
  private files = new Map<string, string>();

  /**
   * Add or update a file in the project
   */
  add_or_update_file(filename: string, content: string): void {
    this.files.set(filename, content);
  }

  /**
   * Get file content
   */
  get_file(filename: string): string | undefined {
    return this.files.get(filename);
  }

  /**
   * Get all files in the project
   */
  get_files(): ReadonlyMap<string, string> {
    return this.files;
  }

  /**
   * Remove a file from the project
   */
  remove_file(filename: string): boolean {
    return this.files.delete(filename);
  }

  /**
   * Find definition at a specific position (stub implementation)
   */
  go_to_definition(filename: string, position: { row: number; column: number }): any {
    // Stub implementation for tests
    return { file: filename, line: position.row, column: position.column };
  }

  /**
   * Find references to a symbol at a specific position (stub implementation)
   */
  find_references(filename: string, position: { row: number; column: number }): any[] {
    // Stub implementation for tests
    return [];
  }

  /**
   * Get all file paths
   */
  get_file_paths(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Check if project is empty
   */
  is_empty(): boolean {
    return this.files.size === 0;
  }

  /**
   * Clear all files
   */
  clear(): void {
    this.files.clear();
  }
}