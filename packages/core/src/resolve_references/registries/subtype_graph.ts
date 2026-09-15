import type { FilePath, SymbolId } from "@ariadnejs/types";
import { first_divergence } from "./member_index";

/**
 * Why a subtype edge holds: the subtype's own declaration names the parent
 * (`extends`, `implements`, a base list, `impl Trait for T`), or its members
 * conform to the parent's without naming it.
 */
type SubtypeEdgeSource = "declared" | "structural";

interface SubtypeEdge {
  readonly source: SubtypeEdgeSource;
  /**
   * The file whose heritage pass wrote the edge, and whose eviction takes it
   * back. Usually the subtype's own file; a Rust `impl Trait for T` block can
   * sit in a file that declares neither `Trait` nor `T`.
   */
  readonly written_by: FilePath;
}

/**
 * The project's heritage graph: which types extend or implement which, keyed
 * on SymbolId at both ends, so two same-named interfaces from different modules
 * are two parents, never one. The single writer of `type_subtypes`,
 * `parent_types` and `edges_by_file`; `DefinitionRegistry` composes one
 * instance, resolves heritage into it, and never writes these maps itself.
 */
export class SubtypeGraph {
  /** Parent type → each subtype that extends or implements it, with the edge that says so. */
  private type_subtypes: Map<SymbolId, Map<SymbolId, SubtypeEdge>> = new Map();

  /**
   * The inverse of `type_subtypes`: subtype → its parents, declared parents
   * first in the order the declaration writes them, then structural ones. The
   * order is what makes the first entry the base `super` names.
   */
  private parent_types: Map<SymbolId, SymbolId[]> = new Map();

  /**
   * File → subtype → the parents whose edges that file's heritage pass wrote,
   * so re-resolving or evicting a file takes back exactly its own edges.
   */
  private edges_by_file: Map<FilePath, Map<SymbolId, Set<SymbolId>>> = new Map();

  /**
   * File → subtype → the parents of edges that file wrote which an eviction
   * has since removed, held until the file's next heritage pass compares
   * against them. Eviction runs before that pass re-resolves the file, so
   * without this record a pass could not tell an `implements` the file
   * dropped from one it never wrote, and the parent's call sites would keep
   * dispatching to the subtype.
   */
  private evicted_edges_by_file: Map<FilePath, Map<SymbolId, Set<SymbolId>>> = new Map();

  /**
   * Record that `subtype_id` extends or implements `parent_id`. An edge already
   * held keeps its source and writer. A declared parent goes ahead of every
   * structural one, so a declaration's own order survives an inferred edge
   * arriving first.
   */
  register_subtype(
    parent_id: SymbolId,
    subtype_id: SymbolId,
    source: SubtypeEdgeSource,
    written_by: FilePath
  ): void {
    let subtypes = this.type_subtypes.get(parent_id);
    if (!subtypes) {
      subtypes = new Map();
      this.type_subtypes.set(parent_id, subtypes);
    }
    if (subtypes.has(subtype_id)) {
      return;
    }
    subtypes.set(subtype_id, { source, written_by });

    let parents = this.parent_types.get(subtype_id);
    if (!parents) {
      parents = [];
      this.parent_types.set(subtype_id, parents);
    }
    const first_structural =
      source === "declared"
        ? parents.findIndex((held) => this.source_of(held, subtype_id) === "structural")
        : -1;
    if (first_structural === -1) {
      parents.push(parent_id);
    } else {
      parents.splice(first_structural, 0, parent_id);
    }

    let written = this.edges_by_file.get(written_by);
    if (!written) {
      written = new Map();
      this.edges_by_file.set(written_by, written);
    }
    let written_parents = written.get(subtype_id);
    if (!written_parents) {
      written_parents = new Set();
      written.set(subtype_id, written_parents);
    }
    written_parents.add(parent_id);
  }

  /**
   * Drop every edge a type sits on, in both roles — the subtypes it is the
   * parent of and the parents it is a subtype of — whichever file wrote them.
   */
  forget_type(type_id: SymbolId): void {
    for (const subtype_id of [...(this.type_subtypes.get(type_id)?.keys() ?? [])]) {
      this.evict_subtype(type_id, subtype_id);
    }
    for (const parent_id of [...(this.parent_types.get(type_id) ?? [])]) {
      this.evict_subtype(parent_id, type_id);
    }
  }

  /** Drop every edge `file_id` wrote, whatever its source. */
  forget_edges_written_by(file_id: FilePath): void {
    for (const [subtype_id, parents] of [...(this.edges_by_file.get(file_id) ?? [])]) {
      for (const parent_id of [...parents]) {
        this.evict_subtype(parent_id, subtype_id);
      }
    }
  }

  /**
   * Subtype → parents for every edge `file_id` wrote that an eviction removed
   * since this was last asked, and forget the record.
   */
  take_evicted_edges_written_by(file_id: FilePath): Map<SymbolId, Set<SymbolId>> {
    const evicted = this.evicted_edges_by_file.get(file_id) ?? new Map<SymbolId, Set<SymbolId>>();
    this.evicted_edges_by_file.delete(file_id);
    return evicted;
  }

  /**
   * Drop the declared edges `file_id` wrote, leaving its structural ones: a
   * file's declarations are re-resolved without disturbing what was inferred
   * about its types.
   */
  forget_declared_edges_written_by(file_id: FilePath): void {
    for (const [subtype_id, parents] of this.declared_edges_written_by(file_id)) {
      for (const parent_id of parents) {
        this.unregister_subtype(parent_id, subtype_id);
      }
    }
  }

  /** Subtype → parents for every declared edge `file_id` wrote, copied. */
  declared_edges_written_by(file_id: FilePath): Map<SymbolId, Set<SymbolId>> {
    const copy = new Map<SymbolId, Set<SymbolId>>();
    for (const [subtype_id, parents] of this.edges_by_file.get(file_id) ?? []) {
      const declared = [...parents].filter(
        (parent_id) => this.source_of(parent_id, subtype_id) === "declared"
      );
      if (declared.length > 0) {
        copy.set(subtype_id, new Set(declared));
      }
    }
    return copy;
  }

  /** The types that directly extend or implement `type_id`. */
  get_subtypes(type_id: SymbolId): Iterable<SymbolId> {
    return this.type_subtypes.get(type_id)?.keys() ?? [];
  }

  /** The types `type_id` directly extends or implements, declared parents first in declaration order. */
  get_parent_types(type_id: SymbolId): readonly SymbolId[] {
    return this.parent_types.get(type_id) ?? [];
  }

  /**
   * `type_ids` and every type they transitively extend or implement. A cycle
   * in a malformed graph ends where it meets a type already collected.
   */
  get_supertype_closure(type_ids: Iterable<SymbolId>): Set<SymbolId> {
    const closure = new Set<SymbolId>();
    const pending = [...type_ids];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (closure.has(next)) {
        continue;
      }
      closure.add(next);
      pending.push(...this.get_parent_types(next));
    }
    return closure;
  }

  /**
   * `parent_types` and `edges_by_file` rebuilt from `type_subtypes`, the
   * forward map they invert, and compared against the live ones: the first
   * divergence found, or null when all three agree. `parent_types` is also
   * checked for the order its readers rely on — no parent listed twice, and no
   * declared parent behind a structural one.
   */
  verify(): string | null {
    const rebuilt_parents = new Map<SymbolId, Set<SymbolId>>();
    const rebuilt_by_file = new Map<string, Set<SymbolId>>();
    for (const [parent_id, subtypes] of this.type_subtypes) {
      for (const [subtype_id, edge] of subtypes) {
        add_to(rebuilt_parents, subtype_id, parent_id);
        add_to(rebuilt_by_file, file_subtype_key(edge.written_by, subtype_id), parent_id);
      }
    }

    const live_parents = new Map<SymbolId, Set<SymbolId>>();
    for (const [subtype_id, parents] of this.parent_types) {
      const distinct = new Set(parents);
      if (distinct.size !== parents.length) {
        return `parent_types["${subtype_id}"] lists a parent more than once`;
      }
      const first_structural = parents.findIndex(
        (parent_id) => this.source_of(parent_id, subtype_id) === "structural"
      );
      if (
        first_structural !== -1 &&
        parents
          .slice(first_structural)
          .some((parent_id) => this.source_of(parent_id, subtype_id) === "declared")
      ) {
        return `parent_types["${subtype_id}"] lists a declared parent behind a structural one`;
      }
      live_parents.set(subtype_id, distinct);
    }

    const live_by_file = new Map<string, Set<SymbolId>>();
    for (const [file_id, subtypes] of this.edges_by_file) {
      for (const [subtype_id, parents] of subtypes) {
        live_by_file.set(file_subtype_key(file_id, subtype_id), parents);
      }
    }

    return (
      first_divergence(live_parents, rebuilt_parents, "parent_types", "type_subtypes") ??
      first_divergence(live_by_file, rebuilt_by_file, "edges_by_file", "type_subtypes")
    );
  }

  clear(): void {
    this.type_subtypes.clear();
    this.parent_types.clear();
    this.edges_by_file.clear();
    this.evicted_edges_by_file.clear();
  }

  private source_of(parent_id: SymbolId, subtype_id: SymbolId): SubtypeEdgeSource | undefined {
    return this.type_subtypes.get(parent_id)?.get(subtype_id)?.source;
  }

  private evict_subtype(parent_id: SymbolId, subtype_id: SymbolId): void {
    const edge = this.type_subtypes.get(parent_id)?.get(subtype_id);
    if (!edge) {
      return;
    }
    let evicted = this.evicted_edges_by_file.get(edge.written_by);
    if (!evicted) {
      evicted = new Map();
      this.evicted_edges_by_file.set(edge.written_by, evicted);
    }
    add_to(evicted, subtype_id, parent_id);
    this.unregister_subtype(parent_id, subtype_id);
  }

  private unregister_subtype(parent_id: SymbolId, subtype_id: SymbolId): void {
    const subtypes = this.type_subtypes.get(parent_id);
    const edge = subtypes?.get(subtype_id);
    if (!subtypes || !edge) {
      return;
    }
    subtypes.delete(subtype_id);
    if (subtypes.size === 0) {
      this.type_subtypes.delete(parent_id);
    }

    const parents = this.parent_types.get(subtype_id);
    const position = parents?.indexOf(parent_id) ?? -1;
    if (parents && position !== -1) {
      parents.splice(position, 1);
      if (parents.length === 0) {
        this.parent_types.delete(subtype_id);
      }
    }

    const written = this.edges_by_file.get(edge.written_by);
    const written_parents = written?.get(subtype_id);
    if (written && written_parents) {
      written_parents.delete(parent_id);
      if (written_parents.size === 0) {
        written.delete(subtype_id);
      }
      if (written.size === 0) {
        this.edges_by_file.delete(edge.written_by);
      }
    }
  }
}

function add_to<K>(map: Map<K, Set<SymbolId>>, key: K, value: SymbolId): void {
  let values = map.get(key);
  if (!values) {
    values = new Set();
    map.set(key, values);
  }
  values.add(value);
}

function file_subtype_key(file_id: FilePath, subtype_id: SymbolId): string {
  return `${file_id} → ${subtype_id}`;
}
