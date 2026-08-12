/**
 * Rust `::`-path resolution, shared by qualified function and constructor calls.
 *
 * A Rust qualified reference (`worker::create`, `crate::runtime::Driver::new`)
 * carries its qualifier as a `path_prefix` rather than a bare name Phase-1 can
 * bind. This resolver binds the terminal under the module or type that prefix
 * names — honouring the author's qualifier over a same-name local that would
 * shadow it in the scope map.
 *
 * The two callers carry the qualifier in different prefix shapes, so each hands
 * over the module path and the terminal separately:
 * - **Function call** — *terminal-last*: the terminal lives in `ref.name`, so the
 *   whole `path_prefix` is the module path (`worker::create` → name `create`,
 *   module path `["worker"]`).
 * - **Constructor** — *type-last*: the terminal type IS the last prefix segment,
 *   so the module path is everything before it (`crate::runtime::Driver::new` →
 *   name `Driver`, module path `["crate","runtime"]`).
 *
 * Four hops run in order, each honouring the qualifier a different way:
 * 1. **`Self` substitution** (`Self::assoc`) — the enclosing `impl`/`trait` type
 *    answers for the qualifier. It runs first because `Self` binds nowhere, so
 *    every hop below would miss it.
 * 2. **Type-qualified member** (`Parker::make`) — the last segment resolves in
 *    scope to a struct/enum; the terminal is one of its associated items.
 * 3. **In-file module body** (`worker::create` with `mod worker { … }`) — the last
 *    segment resolves in scope to a module whose body is a child scope.
 * 4. **Module file** (`config::build` with `mod config;`) — the path names a file
 *    of its own, and the terminal is resolved inside it. A leftover segment is
 *    the terminal's owning type, an inline `mod` block of that file, or a
 *    further module hop.
 *
 * The module-file hop takes the path un-normalized, leading `crate`/`self`/
 * `super` included, because those anchors are what pin it to a directory. Two
 * rules keep it from fabricating an edge: the leading segment must be something
 * a Rust path root can be — an anchor, a module bound in scope, or a workspace
 * crate — and the file it lands on must be one the project has **indexed**. A
 * `use` that binds an item rather than a module is never followed as a module,
 * so `Foo::bar()` and `serde_json::to_string()` fall through untouched.
 *
 * A path that misses every hop is not resolved here; `function_call.rust.ts`
 * then looks for a `use` statement in lexical scope that anchors the terminal.
 */

import type {
  SymbolId,
  SymbolName,
  ScopeId,
  FilePath,
  Language,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { ScopeRegistry } from "../registries/scope";
import type { ExportRegistry } from "../registries/export";
import type { ResolutionRegistry } from "../resolution_registry";
import type { ImportGraph } from "../import_resolution/import_graph";
import type { ModuleResolutionContext } from "../import_resolution";
import { resolve_module_path_rust } from "../import_resolution/import_resolution.rust";
import {
  find_containing_class_scope,
  find_class_from_scope,
} from "./receiver_resolution";

const PATH_ANCHORS: ReadonlySet<string> = new Set(["crate", "self", "super"]);

/**
 * The keyword a Rust associated function uses to name its own impl type, e.g.
 * `Self::new()`. `Self` is neither an anchor nor a binding — it stands for the
 * enclosing `impl`/`trait` type — so it is substituted before any anchor is
 * read, and never joins `PATH_ANCHORS`.
 */
export const RUST_SELF_TYPE_KEYWORD = "Self" as SymbolName;

/**
 * What the terminal of a qualified path is allowed to be: a callable for a call
 * site, a type for a constructor. A callable terminal may additionally be an
 * associated item of a type named by the path's last segment; a type terminal
 * never is, because the type terminals that reach here are struct/enum names
 * found through modules, and a variant or associated type resolves as a member
 * of its owner rather than as a path terminal.
 */
type RustTerminalKind = "callable" | "type";

/** Everything path resolution reads about the project. */
export interface RustPathResolutionContext {
  readonly definitions: DefinitionRegistry;
  readonly scopes: ScopeRegistry;
  readonly resolutions: ResolutionRegistry;
  readonly exports: ExportRegistry;
  readonly imports: ImportGraph;
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly resolution: ModuleResolutionContext;
}

/**
 * Drop leading crate/self/super anchors — they pin the path to a module root
 * but do not name a binding the scope resolver can look up. Used to compare a
 * call's prefix against a `use` statement's module path, which may spell the
 * same module with a different anchor.
 */
export function normalize_path_prefix(
  path_prefix: readonly SymbolName[]
): readonly SymbolName[] {
  let start = 0;
  while (start < path_prefix.length && PATH_ANCHORS.has(path_prefix[start])) {
    start++;
  }
  return path_prefix.slice(start);
}

/**
 * A call may only bind to a callable target — guards a type-qualified member
 * lookup against binding `Type::field()` to a non-callable property.
 */
export function is_callable_definition(
  symbol_id: SymbolId,
  definitions: DefinitionRegistry
): boolean {
  const kind = definitions.get(symbol_id)?.kind;
  return kind === "method" || kind === "constructor" || kind === "function";
}

/**
 * Resolve `<module_path>::<terminal>` to the definition it names.
 *
 * Returns null on a miss; callers then fall back to their own bare-name paths.
 */
export function resolve_qualified_path_rust(
  module_path: readonly SymbolName[],
  terminal: SymbolName,
  terminal_kind: RustTerminalKind,
  scope_id: ScopeId,
  referring_file: FilePath,
  context: RustPathResolutionContext
): SymbolId | null {
  if (module_path.length === 0) return null;

  // `Self` stands for the enclosing impl type, which is a symbol rather than a
  // name any later hop could look up, so it is resolved here and its member
  // taken directly. Substitution runs first: `Self` binds nowhere, so every
  // hop below would miss.
  if (module_path[0] === RUST_SELF_TYPE_KEYWORD) {
    // A `Self` path names an associated item of the impl type directly, so a
    // deeper path has no meaning here; a type terminal (`Self::new()`) is
    // substituted at the constructor call site instead.
    if (module_path.length > 1 || terminal_kind !== "callable") return null;
    const self_type = resolve_self_type_rust(
      scope_id,
      context.scopes,
      context.definitions
    );
    return self_type
      ? resolve_associated_item(self_type, terminal, context)
      : null;
  }

  const qualifier = module_path[module_path.length - 1];
  const qualifier_id = context.resolutions.resolve(scope_id, qualifier);
  if (qualifier_id) {
    const qualifier_def = context.definitions.get(qualifier_id);

    // Associated functions are stored as `kind: "method"`; the method-rejection
    // gate that guards bare function calls is bypassed here because the
    // qualifier names the owning type explicitly. A trait qualifies its methods
    // the same way — `Default::default(x)` — and the member index holds them.
    if (
      terminal_kind === "callable" &&
      (qualifier_def?.kind === "class" ||
        qualifier_def?.kind === "enum" ||
        qualifier_def?.kind === "interface")
    ) {
      const member = resolve_associated_item(qualifier_id, terminal, context);
      if (member) return member;
    }

    if (qualifier_def?.kind === "namespace") {
      const member = resolve_in_module_body(
        qualifier,
        qualifier_def.defining_scope_id,
        terminal,
        context.scopes,
        context.definitions
      );
      if (member) return member;
    }
  }

  return resolve_via_module_file(
    module_path,
    terminal,
    terminal_kind,
    scope_id,
    referring_file,
    context
  );
}

/**
 * Resolve the terminal inside a module file the path names.
 *
 * The leading segment decides where the search may start. An anchor pins the
 * path to a directory; any other leading segment must name something the author
 * brought into scope — a module, or a crate of the workspace — because that is
 * all a Rust path root can be. Without that rule a bare segment would be
 * matched against the referring file's siblings on disk, so `std::fs::read` in
 * a crate that happens to own a `fs` module would bind inside the crate.
 *
 * A module the author bound wins over a same-named file on disk: the binding is
 * what they wrote, the sibling is a guess. Failing that, the longest leading run
 * of segments is resolved to a file and shortened one segment at a time, so
 * `x::Type::assoc` lands on `x.rs` with `Type` left over. Every landing is tried
 * in turn rather than committing to the deepest one.
 */
function resolve_via_module_file(
  module_path: readonly SymbolName[],
  terminal: SymbolName,
  terminal_kind: RustTerminalKind,
  scope_id: ScopeId,
  referring_file: FilePath,
  context: RustPathResolutionContext
): SymbolId | null {
  const root = module_path[0];

  for (const anchor of module_files_bound_in_scope(root, scope_id, context)) {
    const resolved = resolve_under_module_file(
      anchor,
      module_path.slice(1),
      terminal,
      terminal_kind,
      context
    );
    if (resolved) return resolved;
  }

  if (!PATH_ANCHORS.has(root) && !context.resolution.specifiers.crate_roots.has(root)) {
    return null;
  }

  for (let take = module_path.length; take > 0; take--) {
    const candidate = resolve_module_path_rust(
      module_path.slice(0, take).join("::"),
      referring_file,
      context.resolution
    );
    if (!is_indexed(candidate, context)) continue;

    const resolved = resolve_under_module_file(
      candidate,
      module_path.slice(take),
      terminal,
      terminal_kind,
      context
    );
    if (resolved) return resolved;
  }

  return null;
}

/**
 * The enclosing `impl`/`trait` type of a scope — what `Self` denotes there.
 * `Self` is never in scope, so a caller that sees the keyword resolves it here
 * instead of through the scope map.
 */
export function resolve_self_type_rust(
  scope_id: ScopeId,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  const class_scope_id = find_containing_class_scope(
    scope_id,
    scopes,
    definitions
  );
  if (!class_scope_id) return null;

  return find_class_from_scope(class_scope_id, definitions);
}

/**
 * Resolve a terminal as a member of a `mod <qualifier> { ... }` whose body scope
 * is a named child of the module's defining scope. Covers the in-file module
 * call (`worker::create`, the inline-path type `runtime::Driver`) without a
 * matching `use`, binding over a local shadow.
 */
function resolve_in_module_body(
  qualifier: SymbolName,
  defining_scope_id: ScopeId,
  terminal: SymbolName,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  const parent_scope = scopes.get_scope(defining_scope_id);
  if (!parent_scope) return null;

  for (const child_id of parent_scope.child_ids) {
    const child = scopes.get_scope(child_id);
    if (child?.name === qualifier && child.type === "module") {
      const member = definitions.get_scope_definitions(child_id).get(terminal);
      if (member) return member;
    }
  }

  return null;
}

/**
 * Resolve `<module_path>::<terminal>` inside a module file already known to
 * hold it — a glob import's target, whose whole surface the glob brings into
 * scope, so the path hangs off that module rather than off the referring file.
 */
export function resolve_under_module_file_rust(
  file: FilePath,
  module_path: readonly SymbolName[],
  terminal: SymbolName,
  terminal_kind: RustTerminalKind,
  context: RustPathResolutionContext
): SymbolId | null {
  return is_indexed(file, context)
    ? resolve_under_module_file(file, module_path, terminal, terminal_kind, context)
    : null;
}

/**
 * Resolve the terminal inside the module file the path landed on, walking any
 * leftover segments as further module hops.
 *
 * A single leftover segment is read as the terminal's owning type first — that
 * is what `x::Type::assoc()` means — then as an inline `mod { … }` block of the
 * landed file, and only then as another module file.
 */
function resolve_under_module_file(
  file: FilePath,
  remaining: readonly SymbolName[],
  terminal: SymbolName,
  terminal_kind: RustTerminalKind,
  context: RustPathResolutionContext
): SymbolId | null {
  if (remaining.length === 0) {
    return resolve_file_level_name(file, terminal, context, terminal_kind);
  }

  const root_scope = context.scopes.get_file_root_scope(file);
  const segment = remaining[0];

  if (remaining.length === 1 && terminal_kind === "callable") {
    const owner = resolve_file_level_name(file, segment, context, "type");
    if (owner) {
      const member = resolve_associated_item(owner, terminal, context);
      if (member) return member;
    }
  }

  // The segment may name an inline `mod { … }` block of the landed file rather
  // than a file of its own — `crate::a::b::f` where `a.rs` holds `mod b { fn f }`.
  if (remaining.length === 1 && root_scope) {
    const in_body = resolve_in_module_body(
      segment,
      root_scope.id,
      terminal,
      context.scopes,
      context.definitions
    );
    if (in_body) return in_body;
  }

  for (const next of module_files_bound_in_scope(
    segment,
    root_scope?.id ?? null,
    context
  )) {
    // A module cannot be its own submodule, so a hop back to the file we are
    // already reading is the one shape that would not shorten `remaining`.
    if (next === file) continue;
    const resolved = resolve_under_module_file(
      next,
      remaining.slice(1),
      terminal,
      terminal_kind,
      context
    );
    if (resolved) return resolved;
  }

  return null;
}

/**
 * Every indexed file a name denotes as a module in a scope chain, from the
 * nearest scope that binds it.
 *
 * A name denotes a module only through a `mod x;` declaration or a `use` whose
 * final segment resolves to a module file of its own. An ordinary `use` of a
 * type or function is NOT a module alias: following it would bind
 * `Type::assoc()` to whatever file-level item of the defining module shares the
 * terminal's name.
 *
 * Several files under one name is the `#[cfg]`-gated declaration — rustc's
 * `sys::process::{unix,windows}` — which declares one module over several
 * files. Ariadne does not evaluate `cfg`, so every variant is a candidate and
 * the caller takes the first that holds the terminal, over-approximating toward
 * reachability the way hoisted functions already do.
 */
function module_files_bound_in_scope(
  name: SymbolName,
  scope_id: ScopeId | null,
  context: RustPathResolutionContext
): readonly FilePath[] {
  let current: ScopeId | null = scope_id;
  while (current) {
    const matches: FilePath[] = [];

    for (const imp of context.imports.get_scope_imports(current)) {
      if (imp.name !== name) continue;

      // A `use a::b;` whose `b` is itself a module records `a` as its resolved
      // path and `b` as a submodule of it; the submodule is the module the name
      // denotes. A `mod x;` edge is a namespace import and needs no submodule
      // probe. Every other import binds an item, not a module.
      const submodule = context.imports.get_submodule_import_path(imp.symbol_id);
      const target =
        submodule ??
        (imp.import_kind === "namespace"
          ? context.imports.get_resolved_import_path(imp.symbol_id)
          : undefined);
      if (target && is_indexed(target, context) && !matches.includes(target)) {
        matches.push(target);
      }
    }

    if (matches.length > 0) return matches;

    current = context.scopes.get_scope(current)?.parent_id ?? null;
  }

  return [];
}

/**
 * A name on a module file's own surface. The export chain answers for `pub`
 * items; a non-`pub` item is still named explicitly by the author's path, so it
 * falls back to the file's module scope — the same carve-out explicit named
 * imports get.
 *
 * A callable terminal must land on something callable. Without that gate a
 * `Type::variant(x)` whose owner is not the file's type would bind to a
 * same-named struct or constant sitting beside it.
 */
function resolve_file_level_name(
  file: FilePath,
  name: SymbolName,
  context: RustPathResolutionContext,
  terminal_kind: RustTerminalKind
): SymbolId | null {
  const found =
    context.exports.resolve_export_chain(
      file,
      name,
      "named",
      context.languages,
      context.resolution
    ) ?? file_scope_definition(file, name, context);
  if (!found) return null;

  return terminal_kind === "callable" &&
    !is_callable_definition(found, context.definitions)
    ? null
    : found;
}

function file_scope_definition(
  file: FilePath,
  name: SymbolName,
  context: RustPathResolutionContext
): SymbolId | null {
  const root_scope = context.scopes.get_file_root_scope(file);
  if (!root_scope) return null;
  return (
    context.definitions.get_scope_definitions(root_scope.id).get(name) ?? null
  );
}

function resolve_associated_item(
  owner: SymbolId,
  terminal: SymbolName,
  context: RustPathResolutionContext
): SymbolId | null {
  const member = context.definitions
    .get_member_index()
    .get(owner)
    ?.get(terminal);
  return member && is_callable_definition(member, context.definitions)
    ? member
    : null;
}

/**
 * A file the project holds is exactly one with a persisted root scope — which is
 * also what the terminal lookup reads, so the guard and the lookup cannot
 * disagree about which files are available.
 */
function is_indexed(
  file: FilePath,
  context: RustPathResolutionContext
): boolean {
  return context.scopes.get_file_root_scope(file) !== undefined;
}
