import type { FilePath, ScopeId, Location, LexicalScope } from "@ariadnejs/types";

/**
 * Registry for scope trees and scope-based queries.
 *
 * Each file has a scope tree (with a root module/file scope).
 * This registry aggregates scope trees from all files and provides:
 * - Scope lookup by ScopeId
 * - Scope chain queries (for lexical scope resolution)
 * - File-based scope queries
 */
export class ScopeRegistry {
  /** File → root scope of that file */
  private scope_trees: Map<FilePath, LexicalScope> = new Map();

  /** Flattened scope lookup by ScopeId (across all files) */
  private by_scope_id: Map<ScopeId, LexicalScope> = new Map();

  /**
   * Update scope tree for a file.
   * Expects scopes map where one scope has parent_id === null (root).
   *
   * @param file_path - The file being updated
   * @param scopes - Map of scopes by their IDs
   */
  update_file(file_path: FilePath, scopes: ReadonlyMap<ScopeId, LexicalScope>): void {
    // Remove old scopes from this file
    this.remove_file(file_path);

    if (scopes.size === 0) {
      return;  // No scopes to add
    }

    // Find root scope (scope with parent_id === null)
    let root_scope: LexicalScope | undefined;
    for (const scope of scopes.values()) {
      if (scope.parent_id === null) {
        root_scope = scope;
        break;
      }
    }

    if (!root_scope) {
      // Fallback: use first scope as root
      root_scope = scopes.values().next().value;
    }

    if (!root_scope) {
      throw new Error(`No root scope found for file: ${file_path}`);
    }

    // Store root scope for the file
    this.scope_trees.set(file_path, root_scope);

    // Index all scopes by ScopeId
    for (const scope of scopes.values()) {
      this.by_scope_id.set(scope.id, scope);
    }
  }

  /**
   * Get the scope chain from a location (innermost to outermost).
   * Returns scopes in order: [innermost, ..., outermost (module scope)].
   *
   * @param file_path - The file containing the location
   * @param location - The location to query
   * @returns Array of scopes from innermost to outermost
   */
  get_enclosing_scopes(file_path: FilePath, location: Location): LexicalScope[] {
    const root = this.scope_trees.get(file_path);
    if (!root) {
      return [];
    }

    // Find the innermost scope containing the location
    const innermost = this.find_innermost_scope(root, location);
    if (!innermost) {
      return [];
    }

    // Build scope chain from innermost to outermost
    const chain: LexicalScope[] = [];
    let current: LexicalScope | undefined = innermost;

    while (current) {
      chain.push(current);

      // Move to parent
      if (current.parent_id) {
        current = this.by_scope_id.get(current.parent_id);
      } else {
        current = undefined;
      }
    }

    return chain;
  }

  /**
   * Find the innermost scope that contains a location.
   * Uses recursive depth-first search.
   *
   * @param scope - Scope to search
   * @param location - Location to find
   * @returns Innermost scope, or undefined if not found
   */
  private find_innermost_scope(scope: LexicalScope, location: Location): LexicalScope | undefined {
    // Check if location is within this scope
    if (!this.scope_contains_location(scope, location)) {
      return undefined;
    }

    // Check children (depth-first)
    if (scope.child_ids && scope.child_ids.length > 0) {
      for (const child_id of scope.child_ids) {
        const child = this.by_scope_id.get(child_id);
        if (child) {
          const result = this.find_innermost_scope(child, location);
          if (result) {
            return result;  // Found in child
          }
        }
      }
    }

    // No child contains it, so this scope is the innermost
    return scope;
  }

  /**
   * Check if a scope contains a location.
   *
   * @param scope - The scope to check
   * @param location - The location to test
   * @returns True if scope contains the location
   */
  private scope_contains_location(scope: LexicalScope, location: Location): boolean {
    const start_line = scope.location.start_line;
    const start_column = scope.location.start_column;
    const end_line = scope.location.end_line;
    const end_column = scope.location.end_column;

    // Simple line-based containment check
    if (location.start_line < start_line || location.start_line > end_line) {
      return false;
    }

    // If on start line, check column
    if (location.start_line === start_line && location.start_column < start_column) {
      return false;
    }

    // If on end line, check column
    if (location.start_line === end_line && location.start_column > end_column) {
      return false;
    }

    return true;
  }

  /**
   * Get scope by ID.
   *
   * @param scope_id - The scope to look up
   * @returns The scope, or undefined if not found
   */
  get_scope(scope_id: ScopeId): LexicalScope | undefined {
    return this.by_scope_id.get(scope_id);
  }

  /**
   * Get root scope for a file.
   *
   * @param file_path - The file to query
   * @returns Root scope, or undefined if file not indexed
   */
  get_file_root_scope(file_path: FilePath): LexicalScope | undefined {
    return this.scope_trees.get(file_path);
  }

  /**
   * Get all scopes (across all files).
   *
   * @returns ReadonlyMap of all scopes by ScopeId
   */
  get_all_scopes(): ReadonlyMap<ScopeId, LexicalScope> {
    return this.by_scope_id;
  }

  /**
   * Get all files with scope trees.
   *
   * @returns Array of file paths
   */
  get_all_files(): FilePath[] {
    return Array.from(this.scope_trees.keys());
  }

  /**
   * Remove all scopes from a file.
   *
   * @param file_path - The file to remove
   */
  remove_file(file_path: FilePath): void {
    const root = this.scope_trees.get(file_path);
    if (!root) {
      return;
    }

    // Remove all scopes from flattened index
    this.remove_scopes_recursively(root);

    // Remove file from trees
    this.scope_trees.delete(file_path);
  }

  /**
   * Recursively remove scopes from the flattened index.
   *
   * @param scope - Root of scope tree to remove
   */
  private remove_scopes_recursively(scope: LexicalScope): void {
    this.by_scope_id.delete(scope.id);

    if (scope.child_ids && scope.child_ids.length > 0) {
      for (const child_id of scope.child_ids) {
        const child = this.by_scope_id.get(child_id);
        if (child) {
          this.remove_scopes_recursively(child);
        }
      }
    }
  }

  /**
   * Get the total number of scopes indexed.
   *
   * @returns Count of scopes
   */
  size(): number {
    return this.by_scope_id.size;
  }

  /**
   * Clear all scopes from the registry.
   */
  clear(): void {
    this.scope_trees.clear();
    this.by_scope_id.clear();
  }
}
