import type { Location } from "./location";
import type { SymbolName } from "./symbol";
import type { ScopeId, ScopeType } from "./scopes";

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

  /**
   * The type a `self`/`this`/`cls`/`Self` receiver is looked up on: the class,
   * interface, enum or trait whose body this scope is, and the type a Rust
   * `impl` block implements. A trait or interface body records the declaration
   * itself, whose members interface-typed dispatch resolves through; the
   * implementor `Self` names at run time is not knowable at index time.
   *
   * Null on every other scope, a method body inside a class included, and null
   * wherever the type has no name a lookup could reach — an anonymous or
   * otherwise unregistered class expression, and a Rust `impl` on a reference,
   * a tuple, a scoped path, or one of the block's own type parameters.
   *
   * A member scope therefore finds its type by walking out to the nearest
   * enclosing class-family scope or `impl` block, not to the nearest non-null
   * field: those two differ exactly where a scope that owns `self` records
   * null, and stopping at the first name would answer with an outer type that
   * does not own the member.
   */
  readonly self_type_name: SymbolName | null;
}
