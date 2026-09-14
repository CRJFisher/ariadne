import type {
  AnyDefinition,
  ClassDefinition,
  FilePath,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";

/**
 * Rebind `alias_name` in `flat_members` to the symbol of the member named by
 * `target_name`, when `target_name` is a bare reference to another member. A
 * no-op when there is no such member or the alias points at itself.
 */
function bind_member_alias(
  alias_name: SymbolName,
  target_name: string | undefined,
  alias_symbol: SymbolId,
  flat_members: Map<SymbolName, SymbolId>
): void {
  if (!target_name) {
    return;
  }
  const target = flat_members.get(target_name as SymbolName);
  if (target && target !== alias_symbol) {
    flat_members.set(alias_name, target);
  }
}

/**
 * The first key on which a live reverse index and a freshly rebuilt one
 * disagree, described well enough to name the write site that caused it, or
 * null when the two are equal.
 */
export function first_divergence<K extends string, V extends string>(
  live: ReadonlyMap<K, ReadonlySet<V>>,
  rebuilt: ReadonlyMap<K, ReadonlySet<V>>,
  live_name: string,
  forward_name: string
): string | null {
  for (const [key, expected] of rebuilt) {
    const held = live.get(key);
    if (!held) {
      return `${live_name} is missing "${key}", which ${forward_name} says has ${expected.size} entr${expected.size === 1 ? "y" : "ies"} — a write site populated ${forward_name} without ${live_name}`;
    }
    for (const value of expected) {
      if (!held.has(value)) {
        return `${live_name}["${key}"] is missing "${value}", which ${forward_name} holds`;
      }
    }
  }

  for (const [key, held] of live) {
    const expected = rebuilt.get(key);
    if (!expected) {
      return `${live_name} still holds "${key}" with ${held.size} entr${held.size === 1 ? "y" : "ies"}, which ${forward_name} no longer has — an eviction path dropped ${forward_name} without ${live_name}`;
    }
    for (const value of held) {
      if (!expected.has(value)) {
        return `${live_name}["${key}"] still holds "${value}", which ${forward_name} no longer has`;
      }
    }
  }

  return null;
}

/**
 * A type's callable-member index — name → member, unioned across every file
 * that contributes to the type — plus the ownership and reverse-lookup
 * indexes built over it. The single writer of `member_index`, `member_owner`,
 * `owner_members`, `members_by_file` and `members_by_name`; `DefinitionRegistry`
 * composes one instance and never writes these maps itself.
 *
 * `definitions` is `DefinitionRegistry.by_symbol`, shared by reference rather
 * than copied, so a member registered there before this index attaches it is
 * visible immediately and an eviction there is visible on the next write.
 */
export class MemberIndex {
  /** Type/class SymbolId → flat (member_name → member_symbol_id) combining methods, properties, and constructors. */
  private member_index: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();

  /**
   * Member SymbolId → the type that declares it. Every member is here, including
   * the accessors `member_index` deduplicates away, so a lookup keyed on a
   * symbol never depends on which accessor won a name.
   */
  private member_owner: Map<SymbolId, SymbolId> = new Map();

  /**
   * The inverse of `member_owner`: declaring type → the members it declares.
   * Evicting a type reads its own members here instead of asking every member
   * in the project who owns it.
   */
  private owner_members: Map<SymbolId, Set<SymbolId>> = new Map();

  /**
   * File → type → the member names that file holds in the type's entry of
   * `member_index`. A type's members are the union of every file that
   * contributes them — a Rust `impl` block in a second file is one — so
   * evicting a file takes back exactly the names it holds and nothing another
   * file contributed. A name two files contend for belongs to the file whose
   * member currently holds it.
   */
  private members_by_file: Map<FilePath, Map<SymbolId, Set<SymbolName>>> =
    new Map();

  /**
   * The reverse of `member_index`: member name → every type whose member
   * index holds that name. This is what a structural match reads when it asks
   * which types declare the members an interface names.
   */
  private members_by_name: Map<SymbolName, Set<SymbolId>> = new Map();

  constructor(private readonly definitions: ReadonlyMap<SymbolId, AnyDefinition>) {}

  /**
   * The single writer of `member_owner`. Both directions of the ownership edge
   * are set here so no caller can record one without the other.
   */
  register_member_owner(member_id: SymbolId, owner_id: SymbolId): void {
    this.member_owner.set(member_id, owner_id);
    let members = this.owner_members.get(owner_id);
    if (!members) {
      members = new Set();
      this.owner_members.set(owner_id, members);
    }
    members.add(member_id);
  }

  /** Drop the ownership edge of one member, from both directions. */
  forget_member(member_id: SymbolId): void {
    const owner_id = this.member_owner.get(member_id);
    if (owner_id !== undefined) {
      const members = this.owner_members.get(owner_id);
      if (members) {
        members.delete(member_id);
        if (members.size === 0) {
          this.owner_members.delete(owner_id);
        }
      }
    }
    this.member_owner.delete(member_id);
  }

  /** Drop every ownership edge a declaring type holds, from both directions. */
  forget_owned_members(owner_id: SymbolId): void {
    const members = this.owner_members.get(owner_id);
    if (!members) {
      return;
    }
    for (const member_id of members) {
      this.member_owner.delete(member_id);
    }
    this.owner_members.delete(owner_id);
  }

  /** The type that declares `member_symbol_id`, or undefined for a non-member. */
  get_member_owner(member_symbol_id: SymbolId): SymbolId | undefined {
    return this.member_owner.get(member_symbol_id);
  }

  /**
   * Name → member for every type, live: a type's map is merged in place as
   * files contribute to it, so a caller holding one across a registry write
   * sees the write. Copy it to hold a snapshot.
   */
  get_member_index(): ReadonlyMap<SymbolId, ReadonlyMap<SymbolName, SymbolId>> {
    return this.member_index;
  }

  /**
   * Every type whose member index holds a member named `name`. A type keeps
   * the members another file contributed after its own declaration is evicted,
   * so a caller that needs a live type checks `get` on the id.
   */
  get_members_by_name(name: SymbolName): ReadonlySet<SymbolId> {
    return this.members_by_name.get(name) ?? new Set();
  }

  /**
   * A type's own members plus those it inherits, walking `parents_of` (the
   * heritage graph `DefinitionRegistry` holds) through parents of the
   * type's own kind only: a class walks its parent classes and an interface
   * its parent interfaces. `ClassDefinition.extends` conflates `extends` with
   * `implements`, and an implemented interface's signatures are not members
   * the class carries. The nearest declaration of a name wins, so a subtype's
   * override shadows its parent's member, and a cycle in a malformed
   * hierarchy terminates because each type is read once.
   */
  get_member_closure(
    type_id: SymbolId,
    parents_of: (type_id: SymbolId) => readonly SymbolId[]
  ): ReadonlyMap<SymbolName, SymbolId> {
    const kind = this.definitions.get(type_id)?.kind;
    const closure = new Map<SymbolName, SymbolId>();
    const visited = new Set<SymbolId>();
    const queue: SymbolId[] = [type_id];
    for (let next = 0; next < queue.length; next++) {
      const current = queue[next];
      if (visited.has(current)) continue;
      visited.add(current);
      for (const [name, member_id] of this.member_index.get(current) ?? []) {
        if (!closure.has(name)) closure.set(name, member_id);
      }
      for (const parent_id of parents_of(current)) {
        // A type the registry no longer holds has no kind to match, so an
        // evicted parent is not walked as a same-kind one.
        if (kind !== undefined && this.definitions.get(parent_id)?.kind === kind) {
          queue.push(parent_id);
        }
      }
    }
    return closure;
  }

  /**
   * Merge `members` into `type_id`'s member index, crediting each name to the
   * file its member is declared in.
   *
   * The single writer of `member_index`, `members_by_file` and
   * `members_by_name`, so a type's members can arrive from more than one file
   * and leave with the file that brought them. Under one name a callable beats
   * a property — this is the callable-member index, and Rust lets a field and
   * a method share a name — and a getter beats any other accessor, because a
   * bare read of the name (`obj.value`) invokes the getter. A member that
   * yields its name to another member leaves its file's provenance, so the
   * provenance always says exactly which names the index holds per file.
   *
   * Entries rather than a name-keyed map, so two members contending for one
   * name both reach the rule instead of one silently overwriting the other on
   * the way in. Every member must already be registered, because the file it
   * is declared in is the provenance `forget_contributed_members` and
   * `verify` both read back.
   */
  attach_members(
    type_id: SymbolId,
    members: Iterable<readonly [SymbolName, SymbolId]>
  ): void {
    let index = this.member_index.get(type_id);
    for (const [name, member_id] of members) {
      const file = this.definitions.get(member_id)?.location.file_path;
      if (file === undefined) {
        throw new Error(
          `attach_members(${type_id}): "${name}" names ${member_id}, which the registry does not hold — a member is registered before it is attached`
        );
      }
      const held = index?.get(name);
      if (held !== undefined && held !== member_id) {
        if (!this.member_takes_slot(member_id, held)) continue;
        this.release_member_name(held, type_id, name);
      }
      // Created on the first name written, so a type with no members leaves no
      // entry for an eviction keyed on provenance to be unable to reach.
      if (!index) {
        index = new Map();
        this.member_index.set(type_id, index);
      }
      index.set(name, member_id);
      this.record_member_name(file, type_id, name);
    }
  }

  /**
   * Whether `candidate` displaces `held` under one name. A property never
   * displaces a callable, and among properties the later one wins, as a
   * class-body alias rebinding does. A callable displaces whatever holds the
   * name except that a setter or deleter never displaces anything: a read of
   * the name reaches the getter, so the getter keeps the slot whatever the
   * declaration order.
   */
  private member_takes_slot(candidate: SymbolId, held: SymbolId): boolean {
    const candidate_def = this.definitions.get(candidate);
    const held_def = this.definitions.get(held);
    const held_callable =
      held_def?.kind === "method" || held_def?.kind === "constructor";
    if (candidate_def?.kind === "constructor") return true;
    if (candidate_def?.kind !== "method") return !held_callable;
    const accessor = candidate_def.accessor_kind;
    return accessor === undefined || accessor === "getter";
  }

  private record_member_name(
    file: FilePath,
    type_id: SymbolId,
    name: SymbolName
  ): void {
    let by_type = this.members_by_file.get(file);
    if (!by_type) {
      by_type = new Map();
      this.members_by_file.set(file, by_type);
    }
    let names = by_type.get(type_id);
    if (!names) {
      names = new Set();
      by_type.set(type_id, names);
    }
    names.add(name);

    let types = this.members_by_name.get(name);
    if (!types) {
      types = new Set();
      this.members_by_name.set(name, types);
    }
    types.add(type_id);
  }

  /**
   * Take `name` out of the provenance of the file whose member `held` it,
   * because another member now holds the name for `type_id`.
   */
  private release_member_name(
    held: SymbolId,
    type_id: SymbolId,
    name: SymbolName
  ): void {
    const file = this.definitions.get(held)?.location.file_path;
    if (file === undefined) return;
    const names = this.members_by_file.get(file)?.get(type_id);
    if (!names) return;
    names.delete(name);
    if (names.size === 0) {
      this.members_by_file.get(file)?.delete(type_id);
      if (this.members_by_file.get(file)?.size === 0) {
        this.members_by_file.delete(file);
      }
    }
  }

  /** Take back every member name `file_id` holds, type by type. */
  forget_contributed_members(file_id: FilePath): void {
    const by_type = this.members_by_file.get(file_id);
    if (!by_type) return;
    for (const [type_id, names] of by_type) {
      const index = this.member_index.get(type_id);
      for (const name of names) {
        index?.delete(name);
        const types = this.members_by_name.get(name);
        if (types) {
          types.delete(type_id);
          if (types.size === 0) this.members_by_name.delete(name);
        }
      }
      if (index && index.size === 0) this.member_index.delete(type_id);
    }
    this.members_by_file.delete(file_id);
  }

  /**
   * The class-body member aliases a class declares — `name = other_member`
   * assignments whose right-hand side names another member of the same class
   * (e.g. sqlalchemy's `__getitem__ = _getitem`) — as the rebindings
   * `attach_members` applies, so the registry keeps one writer of the member
   * index and calls through the alias resolve to the real member.
   *
   * Driven by class PropertyDefinitions carrying the right-hand side in
   * `initial_value`. Only literal member-to-member aliases bind; an RHS that is
   * not a bare member name matches no member and is ignored.
   *
   * Both class-body-level assignments and ones inside a class-body conditional
   * block (e.g. `if not TYPE_CHECKING: __getitem__ = _getitem`) arrive here as
   * class properties: the indexer lifts the conditional form to a class
   * attribute (query_code_tree/queries/python.scm), so no scope reasoning is
   * needed in the registry.
   */
  capture_member_aliases(
    class_def: ClassDefinition,
    members: ReadonlyMap<SymbolName, SymbolId>
  ): [SymbolName, SymbolId][] {
    const rebound = new Map(members);
    for (const prop of class_def.properties) {
      bind_member_alias(prop.name, prop.initial_value, prop.symbol_id, rebound);
    }
    // Only the names a rebinding changed: the map handed in is the type's whole
    // member index, other files' contributions included, and re-attaching those
    // would say nothing while costing a pass over every member.
    return [...rebound].filter(([name, member_id]) => members.get(name) !== member_id);
  }

  /**
   * `member_owner`/`owner_members` and `members_by_file`/`members_by_name`
   * each rebuilt from the forward map they invert and compared against the
   * live one: the first divergence, or null when all four agree.
   *
   * A write site that populates a forward map and forgets its reverse index
   * fails silently rather than loudly: eviction under-deletes, the stale
   * ownership edge outlives the file that produced it, and the call graph moves
   * an edge onto a symbol that no longer exists. Nothing observable says so.
   * Rebuilding is what makes that failure speak.
   */
  verify(): string | null {
    const rebuilt_owner_members = new Map<SymbolId, Set<SymbolId>>();
    for (const [member_id, owner_id] of this.member_owner) {
      let members = rebuilt_owner_members.get(owner_id);
      if (!members) {
        members = new Set();
        rebuilt_owner_members.set(owner_id, members);
      }
      members.add(member_id);
    }

    // Provenance is rebuilt from the file each held member is defined in, so
    // a write to `member_index` that skipped `attach_members` shows up as a
    // name no file holds, and an eviction that skipped a file as a name the
    // index no longer has.
    const rebuilt_members_by_file = new Map<string, Set<string>>();
    const rebuilt_members_by_name = new Map<string, Set<string>>();
    for (const [type_id, members] of this.member_index) {
      for (const [name, member_id] of members) {
        const file = this.definitions.get(member_id)?.location.file_path;
        if (file === undefined) {
          return `member_index["${type_id}"]["${name}"] holds "${member_id}", which by_symbol does not hold, so no file can own it`;
        }
        const key = `${file} → ${type_id}`;
        let names = rebuilt_members_by_file.get(key);
        if (!names) {
          names = new Set();
          rebuilt_members_by_file.set(key, names);
        }
        names.add(name);
        let types = rebuilt_members_by_name.get(name);
        if (!types) {
          types = new Set();
          rebuilt_members_by_name.set(name, types);
        }
        types.add(type_id);
      }
    }
    const live_members_by_file = new Map<string, Set<string>>();
    for (const [file, by_type] of this.members_by_file) {
      for (const [type_id, names] of by_type) {
        live_members_by_file.set(`${file} → ${type_id}`, new Set(names));
      }
    }

    return (
      first_divergence(
        this.owner_members,
        rebuilt_owner_members,
        "owner_members",
        "member_owner"
      ) ??
      first_divergence(
        live_members_by_file,
        rebuilt_members_by_file,
        "members_by_file",
        "member_index"
      ) ??
      first_divergence(
        this.members_by_name,
        rebuilt_members_by_name,
        "members_by_name",
        "member_index"
      )
    );
  }

  clear(): void {
    this.member_index.clear();
    this.member_owner.clear();
    this.owner_members.clear();
    this.members_by_file.clear();
    this.members_by_name.clear();
  }
}
