/**
 * Semantic Index - Unified symbol extraction with lexical scoping
 *
 * Essential types for call chain resolution and cross-file symbol tracking.
 * Language-agnostic with minimal fields needed for call graph construction.
 */

import type { Location, Language } from "./common";
import type { FilePath } from "./common";
import type { SymbolId, SymbolName } from "./symbol";
import type { ScopeId, ScopeType } from "./scopes";
import type { Import, Export } from "./import_export";

/**
 * Symbol kind - essential for resolution rules
 */
export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "constructor"
  | "parameter"
  | "variable"
  | "constant"
  | "import"
  | "interface"
  | "enum"
  | "type_alias";

/**
 * Reference type - essential for call chain tracking
 */
export type ReferenceType =
  | "call" // Function/method call - CRITICAL for call chains
  | "construct" // Constructor call - CRITICAL for call chains
  | "read" // Variable read
  | "write" // Variable write
  | "member_access" // Property/method access - needed for method resolution
  | "type" // Type reference
  | "assignment" // Assignment target/source connection
  | "return"; // Return value - tracks function return types

/**
 * Lexical scope with symbols
 * Self-contained scope with symbol table for resolution
 */
export interface LexicalScope {
  /** Unique scope identifier */
  readonly id: ScopeId;

  /** Parent scope ID (null for root) */
  readonly parent_id: ScopeId | null;

  /** Scope name (for named scopes like functions/classes) */
  readonly name: SymbolName | null;

  /** Type of scope */
  readonly type: ScopeType;

  /** Scope location */
  readonly location: Location;

  /** Child scope IDs */
  readonly child_ids: readonly ScopeId[];

  /** Symbols defined in this scope */
  readonly symbols: Map<SymbolName, SymbolDefinition>;
}

/**
 * Symbol definition - minimal fields for call resolution
 */
export interface SymbolDefinition {
  /** Universal symbol ID */
  readonly id: SymbolId;

  /** Local name in scope */
  readonly name: SymbolName;

  /** Kind determines resolution behavior */
  readonly kind: SymbolKind;

  /** Definition location */
  readonly location: Location;

  /** Containing scope  */
  readonly scope_id: ScopeId;

  /** Hoisting behavior - CRITICAL for JS/TS */
  readonly is_hoisted: boolean;

  /** Module boundary markers */
  readonly is_exported: boolean;
  readonly is_imported: boolean;

  /** For imports: source module */
  readonly import_source?: FilePath;

  /** For exports: exported name if different */
  readonly exported_as?: SymbolName;

  /** For classes: what it extends */
  readonly extends_class?: SymbolName;

  /** For classes: what it implements */
  readonly implements_interfaces?: readonly SymbolName[];

  /** For methods: whether it's static */
  readonly is_static?: boolean;

  /** For functions/methods: return type hint */
  readonly return_type_hint?: SymbolName;

  /** All references to this symbol */
  readonly references: readonly SymbolReference[];
}

/**
 * Symbol reference - tracks usage for call chains
 */
export interface SymbolReference {
  /** Reference location */
  readonly location: Location;

  /** Type of reference - CRITICAL for call detection */
  readonly type: ReferenceType;

  /** Scope containing this reference */
  readonly scope_id: ScopeId;

  /** Name being referenced */
  readonly name: SymbolName;

  /** Additional context for resolution */
  readonly context?: ReferenceContext;
}

/**
 * Additional context for complex references
 */
export interface ReferenceContext {
  /** For method calls: the receiver object location */
  readonly receiver_location?: Location;

  /** For assignments: the source value location */
  readonly assignment_source?: Location;

  /** For assignments: the target variable location */
  readonly assignment_target?: Location;

  /** For constructor calls: the variable being assigned to */
  readonly construct_target?: Location;

  /** For returns: the containing function */
  readonly containing_function?: SymbolId;

  /** For member access: the property chain */
  readonly property_chain?: readonly SymbolName[];
}

/**
 * Complete semantic index for a file
 * Core data structure for symbol resolution and call chain analysis
 */
export interface SemanticIndex {
  /** File being indexed */
  readonly file_path: FilePath;

  /** Language for language-specific resolution */
  readonly language: Language;

  /** Root scope ID (module/global scope) */
  readonly root_scope_id: ScopeId;

  /** All scopes in the file */
  readonly scopes: ReadonlyMap<ScopeId, LexicalScope>;

  /** All symbols in the file */
  readonly symbols: ReadonlyMap<SymbolId, SymbolDefinition>;

  /** Unresolved references (for cross-file resolution) */
  readonly unresolved_references: readonly SymbolReference[];

  /** Module imports */
  readonly imports: readonly Import[];

  /** Module exports */
  readonly exports: readonly Export[];

  /** Quick lookup: name -> symbols with that name */
  readonly file_symbols_by_name: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

/**
 * Cross-file semantic index
 * Aggregates multiple file indices for project-wide resolution
 */
export interface ProjectSemanticIndex {
  /** All indexed files */
  readonly files: ReadonlyMap<FilePath, SemanticIndex>;

  /** Global symbol table (exported symbols only) */
  readonly global_symbols: ReadonlyMap<SymbolId, SymbolDefinition>;

  /** Module dependency graph */
  readonly import_graph: ReadonlyMap<FilePath, readonly FilePath[]>;

  /** Export graph (who exports what) */
  readonly export_graph: ReadonlyMap<
    FilePath,
    ReadonlyMap<SymbolName, SymbolId>
  >;
}
