import type { FilePath, ScopeId, LexicalScope } from "@ariadnejs/types";

/**
 * Aggregates per-file scope trees and serves scope lookups during cross-file
 * resolution. Each file contributes one tree rooted at its module/file scope;
 * the flattened `by_scope_id` index spans every file so scope-chain walks can
 * follow `parent_id`/`child_ids` across the whole project by ScopeId alone.
 */
export class ScopeRegistry {
  private scope_trees: Map<FilePath, LexicalScope> = new Map();
  private by_scope_id: Map<ScopeId, LexicalScope> = new Map();

  update_file(file_path: FilePath, scopes: ReadonlyMap<ScopeId, LexicalScope>): void {
    this.remove_file(file_path);

    if (scopes.size === 0) {
      return;
    }

    let root_scope: LexicalScope | undefined;
    for (const scope of scopes.values()) {
      if (scope.parent_id === null) {
        root_scope = scope;
        break;
      }
    }

    // A well-formed tree always has a parent-less root; fall back to the first
    // scope so a malformed (rootless) index still indexes rather than throwing.
    if (!root_scope) {
      root_scope = scopes.values().next().value;
    }

    if (!root_scope) {
      throw new Error(`No root scope found for file: ${file_path}`);
    }

    this.scope_trees.set(file_path, root_scope);

    for (const scope of scopes.values()) {
      this.by_scope_id.set(scope.id, scope);
    }
  }

  get_scope(scope_id: ScopeId): LexicalScope | undefined {
    return this.by_scope_id.get(scope_id);
  }

  get_file_root_scope(file_path: FilePath): LexicalScope | undefined {
    return this.scope_trees.get(file_path);
  }

  get_all_scopes(): ReadonlyMap<ScopeId, LexicalScope> {
    return this.by_scope_id;
  }

  remove_file(file_path: FilePath): void {
    const root = this.scope_trees.get(file_path);
    if (!root) {
      return;
    }

    this.remove_scopes_recursively(root);
    this.scope_trees.delete(file_path);
  }

  /**
   * Walks `child_ids` to purge a whole file's scopes from the flattened index.
   * Children are resolved through `by_scope_id` before the parent is deleted,
   * so the tree must still be intact when this runs.
   */
  private remove_scopes_recursively(scope: LexicalScope): void {
    this.by_scope_id.delete(scope.id);

    for (const child_id of scope.child_ids) {
      const child = this.by_scope_id.get(child_id);
      if (child) {
        this.remove_scopes_recursively(child);
      }
    }
  }

  clear(): void {
    this.scope_trees.clear();
    this.by_scope_id.clear();
  }
}
