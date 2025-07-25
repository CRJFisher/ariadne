/**
 * Base interface for all graph edges
 */
interface BaseEdge {
  source_id: number;
  target_id: number;
}

/**
 * Edge from a definition to its containing scope
 */
export interface DefToScope extends BaseEdge {
  kind: 'def_to_scope';
}

/**
 * Edge from a reference to its definition
 */
export interface RefToDef extends BaseEdge {
  kind: 'ref_to_def';
}

/**
 * Edge from a scope to its parent scope
 */
export interface ScopeToScope extends BaseEdge {
  kind: 'scope_to_scope';
}

/**
 * Edge from an import to its containing scope
 */
export interface ImportToScope extends BaseEdge {
  kind: 'import_to_scope';
}

/**
 * Edge from a reference to an import
 */
export interface RefToImport extends BaseEdge {
  kind: 'ref_to_import';
}

/**
 * Union type for all edge types
 */
export type Edge = DefToScope | RefToDef | ScopeToScope | ImportToScope | RefToImport;