---
paths: packages/core/src/resolve_references/**
---

# Resolve References

## Purpose

`resolve_references` resolves symbol names to `SymbolId`s and resolves function/method/constructor calls to their target definitions. It operates on the project-level registries built from per-file `SemanticIndex` data.

## 2-Phase Architecture

### Phase 1: Name Resolution (`name_resolution.ts`)

Resolves symbol names within scopes using lexical scope walk:

1. Check local scope definitions
2. Check imports
3. Walk up to parent scope (repeat)

**Output:** `Map<ScopeId, ScopeResolutions>`, where `ScopeResolutions` is `{ own, parent }` — the
names a scope binds itself, chained to its enclosing scope. A lookup that misses `own` walks
`parent` (`lookup_in_scope_chain`), so the chain is walked at read time rather than flattened
into every scope at write time. A scope binding nothing shares its parent's link outright.

Chains never cross a file boundary — each file starts at its root scope with no parent — so
evicting a file drops every link it owns and leaves none dangling.

Two bindings are layered in from descendant `block` scopes, into the enclosing function or
module — never into another block, which is itself one of the branches being lifted out of.

- **JavaScript/Rust function declarations** fill only a name with no closer binding.
- **Python imports**, because Python has no block scoping, so `if TYPE_CHECKING: from m
import C` binds `C` where its unguarded form would. A hoisted import shadows the wildcard
  layer and everything the scope chain inherits, exactly as its unguarded form would, and
  loses only to an import the scope writes itself and to its own local definitions.

The block scope itself stays in both cases — it is what keeps two branches' same-named
bindings apart, and what confines an `except … as e` alias Python deletes at the end of the
clause.

### Phase 2: Call Resolution (`call_resolution/`)

Resolves call references to their target definitions using name resolution results + type information:

- **Function calls** → Direct name lookup in scope via Phase 1 results
- **Self receivers** (`this`/`self`/`cls`/`Self`) → The scope tree names the type. Each scope that binds a self receiver records it as `LexicalScope.self_type_name`, so `find_self_type` walks up to the nearest scope carrying a name, resolves that name where the scope records it, and checks the result is a class/interface/enum. Reading the declared name — rather than inferring the owner from the members the scope holds — is what lets a body with no members of its own name its type: a constructor-only class, a constructor body, a class-field initialiser, a cross-file Rust `impl`. A `this` in no such scope binds instead to the function collection holding it, either the collection whose member body encloses the call or the enclosing function's own collection (`function View(){ this.lookup() }` with `View.prototype.lookup = fn`).
- **Type heritage** → Every heritage name a declaration writes — a class's or interface's `extends`/`implements` entries, a Python base list, the trait of a Rust `impl Trait for T` method — resolves in one place, `DefinitionRegistry.resolve_type_heritage`, once per resolve pass after name resolution, through `TypeRegistry.resolve_type_name`: the annotation resolver, so `o.TypeVisitor`, `compiler.DDLCompiler` and `Base<T>` name the definition they denote. Each edge lands in `SubtypeGraph` (`registries/subtype_graph.ts`) keyed on the resolved parent's `SymbolId`, so two same-named interfaces from different modules are two parents. An edge carries its source — `declared` by the subtype, or `structural` — and the file that wrote it, which evicts it: a Rust `impl` block can sit in a file that declares neither the trait nor the type. `get_parent_types` lists a type's parents declared-first in declaration order; `TypeRegistry.walk_inheritance_chain` linearises them breadth first (the type, its bases in order, then theirs), so index 1 is the base `super` names and `get_type_member` finds a member any number of hops up, through interfaces as well as classes. A Rust method whose `impl` names a type the file does not declare is indexed unattached (`SemanticIndex.unattached_impl_methods`), carrying `impl_self_type` and `impl_trait_name`; `DefinitionRegistry.attach_impl_methods` runs first in the same phase, resolves `impl_self_type` and joins the method to that type's member index and ownership, credited to the impl's file so it leaves with that file.
- **Method calls** → Receiver type → class definition → member lookup (with polymorphic dispatch). An interface-typed receiver resolves to the interface member the call names _and_ every implementation that runs: the member leads the list so "who calls `IFoo.bar`" stays answerable, the implementations follow so entry-point detection reaches the bodies. The interface member has no body scope, so it is never a call-graph node — the attribution is additive. A class-typed receiver resolves to the member plus every subtype override. When a class or interface receiver neither declares nor inherits the member, the lookup fans out over its transitive subtypes and resolves to every one that declares it — an abstract base calling a hook only its subclasses define — excluding constructors, which run for exactly one class; `method_not_on_type` means no subtype the lookup may reach declares it either. All three expansions enumerate the subtype closure through `method_lookup.ts`'s `resolve_polymorphic_method`, and the lookup returns the receiver whose closure it read (`MethodLookup.subtype_closure_of`) beside its targets.
- **`super` receivers** → `super().m()` runs the next class declaring `m` in the method resolution order of the object the call runs on, never an override below the parent — the calling class's own, or a sibling's nothing mixes in. `method_lookup.ts`'s `resolve_super_method` takes the calling class and every transitive subtype of it as the classes the call can run on, linearises each over its class bases by C3 (interfaces take no part), and resolves to the first class after the calling class that declares the member in each. Under single inheritance every one answers the member the parent declares or inherits; a Python subclass with several bases under one parent (`class Draft(Article, Audited)`) puts a sibling between them, so `super().save()` inside `Article` also reaches `Audited.save`. The answer names the parent's subtype closure, so a subclass arriving below the calling class, or a sibling's members changing, re-answers the call. `super().a.m()` has left the parent for the value `a` holds and resolves as a value receiver.
- **Annotated receivers** → A declared annotation types its binding once, when the `TypeRegistry` indexes the file, never again at the call. `type_preprocessing/annotation.ts` parses the text under its language's grammar into a head name chain and type arguments, removing every wrapper that does not change which type's members a receiver reaches: nullish unions (`F | null`, `Optional[C]`, `{X=}`), references and lifetimes (`&'a mut S`), `dyn`/`impl` bounds, quoted forward references, and the fixed Rust set `Option`/`Box`/`Rc`/`Arc`. A container keeps its head (`Vec<T>`, `F[]` → `Array<F>`), with its element as an argument. `TypeRegistry.resolve_annotation` resolves the head: a bare name in lexical scope; a qualified head segment by segment, each hop only out of an import that denotes a whole module (a namespace import, or a named import of a submodule); a Rust `::` head through the Rust path resolver, which the project hands in; an inline `import("./m").X` among the named module's members, recorded as a module path read of the file. A constructor callee chain (`new models.User()`) resolves through the same head resolution. Annotation bindings are keyed by `SymbolId`, so two definitions over one span — a TypeScript parameter property, a Python class-body annotation — each keep their type. A value's annotation (variable, parameter, class property, struct field) types what the binding holds (`get_symbol_type`), with its resolved type arguments beside it (`get_symbol_type_arguments`), all or nothing. A function's or method's return annotation — on a class, interface or enum alike — is a separate fact (`get_callable_return_type`): a receiver chain hop through a function or method continues on its return type (`e.connect().exec()`, `self.header().encoded_size()`), a hop through anything else on the value it holds. JavaScript writes its annotations in JSDoc: `@type` on a declarator, a class field or a constructor's `this.x = …`, `@param` on a parameter.
- **Constructed and call-initialised receivers** → A construction types what stores it, keyed by location: `const t = new T()` the declarator, `x = new T()` a class field, and `this.x = new T()` the field the class body declares — or, in JavaScript, the field that constructor write itself declares when the body declares none. A construction passed as an argument types nothing (`const t = new Outer(new Inner())` holds an `Outer`), and neither does one nested in an object, dict, set, tuple or struct literal. A construction in a sequence literal (`const suites = [new Suite()]`, `[Suite()]`, `[Layer::new()]`) types the binding's element, never the binding: the reference carries `construct_element_of` instead of `construct_target`. A variable with no annotation and no construction takes the declared return type of what its initialiser calls: `initialized_from_call` carries the callee chain root first (`s.getInfo()` → `["s", "getInfo"]`, and in JavaScript/TypeScript a construction's constructor, `new cls()` → `["cls"]`), and `TypeRegistry` resolves it — a self receiver through the self-type lookup the project hands in, a type's static member, a module import's member, or a member of the type already recorded for a value this file declares — to a function or method, whose return annotation is parsed and resolved in its own file. A value another file declares is not followed, so the answer does not depend on the order files resolve in. `type[X]` and TypeScript/JSDoc `typeof X` keep `type`/`typeof` as the head and `X` as the argument: they denote the class object, not an instance. A function or method returning one records the class apart from its return type (`get_callable_return_class`, from `type_preprocessing/class_object_shape.ts`), and a binding it initialises is a value source's to answer.
- **Container element receivers** → A call on one element of a container resolves against the element's type. `TypeRegistry` records each container binding's element once (`get_container_element`): from its sequence literal's constructions, or from its annotation when the head is one of the closed container shapes `type_preprocessing/container_shape.ts` lists — sequences (`Array`/`T[]`, `Set`, `list`, `Vec`) and keyed containers (`Map`, `dict`, `HashMap`, `DisposableMap`), whose element is the value. The element argument resolves on its own, since the all-or-nothing type arguments drop every `Map<string, V>`. `call_resolution/container_element.ts` answers what a read yields: an index or `get(k)` read yields the element of either shape; iterating a sequence yields its elements, iterating a keyed container yields entries or keys, so only `values()` or an entry's value half is the element. Where nothing is recorded, a sequence literal's element identifiers (`var suites = [suite]`) supply it when their recorded types agree. `receiver_resolution.ts` takes the hop three ways: an index-access receiver (`ReceiverExpression.index_access`, from `call_site_syntax`) with a literal key reads its container — a non-literal key stays unresolved; a `get(k)` chain hop reads the container binding before it; and a binding a container read initialises — `collection_source` for `x = c[k]` / `c.get(k)`, `iterated_from` for a loop or array pattern (`for (const [k, v] of m)`, `for v in d.values()`, `for l in &self.layers`, and the counted half of Python `enumerate(xs)` and Rust `.enumerate()`) — holds its container's element, the first producer of its value source.
- **Destructured binding receivers** → `const { storage } = options` types `storage` as `options.storage` — the source identifier and property key are captured at index time (`destructured_from` / `destructured_key` on `VariableDefinition`, JS/TS only, identifier initializer only) and `receiver_resolution.ts` types the binding with one property hop off the source's type. A chain of destructurings resolves one hop at a time under a visited-set guard.
- **Value sources** → What a binding holds, when the value flows into it rather than its declaration stating a type: an instance of a type, a class object, or a callable. `call_resolution/value_source.ts` answers it once for four consumers, from producers tried in order: the container element a container read yields; what calling an initialiser's callee yields (`p = parser(io)`, and for Python `initialized_from_call_result`, `p = make()(io)`) — a class object for a declared class-object return, an instance for a declared return type or for a class object called; what the member a qualified member read names holds (`member_source`: `orig = BaseTask.__call__`, `feed_type = feedgenerator.DefaultFeed`); and what the one name a local carrier reads holds (`name_source`: `mapper_cls = Mapper`, `Info=TraceInfo`). The indexer records `name_source` and `member_source` from the syntax tree on a variable's or class attribute's initialiser and a parameter's default; the value source never re-reads initialiser text. A carrier never crosses a function boundary, so a class handed in as an argument holds nothing. A scope can bind one name several times and name resolution keeps one of them, so a read at a known position takes the one binding `DefinitionRegistry.get_scope_rebindings` shows preceding it, and holds nothing where several do. The consumers: a receiver identifier with no recorded type takes the type an instance or class object names — `receiver_resolution.ts` is handed that answer as a `HeldValueType` callback (`resolve_held_type`), since the value source resolves name chains through it and the value import runs one way; a construction whose callee is a binding constructs the class object it holds (`const cls = Parser; new cls()`); a bare call through a binding holding a callable or a class object reaches it, while an instance is left to the Python `__call__` protocol; and a `property_access` read whose value is a function or method marks it indirectly reachable (`self.loop = loops.synloop`) without claiming a call edge for whatever later invokes the stored value.
- **Constructor calls** → Type name → class definition → constructor lookup
- **Rust `::` paths** → The qualifier the author wrote binds the terminal, ahead of any same-name local. `path_resolution.rust.ts` owns the qualifier hops, in order: `Self` substitutes the enclosing impl type; a qualifier naming a type takes the terminal from its member index; a qualifier naming an in-file `mod` block takes it from that body; otherwise the path resolves to a module **file** and the terminal is looked up inside it. When the path names nothing the project holds, `function_call.rust.ts` falls back to a `use` statement in lexical scope that anchors the terminal — named imports first, then a wildcard edge fanned out across the module's whole surface.

  Two rules stop the file hop fabricating an edge: the leading segment must be something a Rust path root can be (a `crate`/`self`/`super` anchor, a module bound in scope, or a workspace crate), and the file it lands on must be one the project has indexed. A `use` that binds an item rather than a module is never followed as a module.

  Every module file the hop reads — each candidate landing, and each module it hops on to from there — is recorded on `ImportGraph` as a `module_path_read` of the referring file. The path names those files and no import statement does, so the edge exists nowhere else. It is recorded whether or not the project holds the file yet, because a caller indexed before its callee has to re-resolve when the callee arrives; that is what makes resolution independent of the order the corpus is indexed in, with no whole-corpus pass. A path read makes its reader a dependent but never a forwarding hub: because every file the path touched is its own edge, the reader is a leaf of the affected-files walk, which keeps one crate root read by every `crate::` path from turning any module's edit into a whole-corpus re-resolution.

- **Rust `mod` declaration → module file** → A bodyless `mod x;` is captured twice: as the `NamespaceDefinition` that binds the name, and as a namespace `ImportDefinition` carrying the edge to the file. `ImportGraph` resolves that edge's path once and caches it, which is what makes the module file a dependency of its declarer — so editing the module re-resolves the declarer, and anything reaching `crate::declarer::x::item` through it. `#[path = "…"]` puts a file path on the edge instead of a `::` path.
- **Collection dispatch** → Variable holding function collection → member function lookup. A static alias (`var A = Ns.A`, carried as `VariableDefinition.member_source`) dispatches to the one member it names, never the union. A stored identifier naming a value that is not callable (a parameter, a variable) is the collection's element, not a call target.
- **Type-token generic return** → A chained method whose return type is a bare generic bound by a type-token parameter (`get<T>(token: Type<T>): T`) resolves against the class the token argument names. The token is carried on the reference's `property_chain_arguments` (captured in `index_single_file`, aligned to `property_chain`) and inferred in `type_token_return.ts`.

**Output:** `Map<FilePath, CallReference[]>` — resolved call references with target `SymbolId`s.

## Module Layout

```
resolve_references/
├── index.ts                      # Stage-2 barrel (registries, ResolutionRegistry, ImportGraph)
├── resolution_registry.ts        # ResolutionRegistry (thin orchestration wrapper)
├── resolution_state.ts           # Immutable state + pure resolution functions
├── name_resolution.ts            # Phase 1: scope-based name resolution
├── module_member_lookup.ts       # One module-member lookup: export chain, then a module-scope definition
├── preprocess_references.ts      # Reference preprocessing (marshaller)
├── preprocess_references.python.ts  # Python class-instantiation calls → constructor calls
├── indirect_reachability.ts      # Functions reachable via collection read, name read or member read
├── file_folders.ts               # Virtual folder tree: I/O-free file-existence checks
├── registries/                   # Project-level data stores
│   ├── definition.ts             # DefinitionRegistry (all definitions, multiple indexes; resolves type heritage)
│   ├── member_index.ts           # MemberIndex (per-type members, unioned across contributing files)
│   ├── subtype_graph.ts          # SubtypeGraph (heritage edges: parent → subtypes, subtype → ordered parents, per writing file; supertype closure)
│   ├── type.ts                   # TypeRegistry (type metadata, type-name resolution, inheritance walk)
│   ├── scope.ts                  # ScopeRegistry (scope tree persistence + enclosing-function walk)
│   ├── export.ts                 # ExportRegistry (export tracking)
│   ├── export.{python,typescript}.ts  # Language-specific export dedup rules
│   └── reference.ts              # ReferenceRegistry (raw reference storage)
├── call_resolution/              # Phase 2: type-aware call resolution
│   ├── call_resolver.ts          # Main orchestrator
│   ├── function_call.ts          # Function call resolution
│   ├── function_call.rust.ts     # Rust ::-qualified call entry + `use`-anchor fallback
│   ├── method_call.ts            # Method call resolution
│   ├── method_lookup.ts          # Polymorphic method lookup
│   ├── constructor.ts            # Constructor resolution
│   ├── constructor.rust.ts       # Rust associated-constructor resolution
│   ├── path_resolution.rust.ts   # The single Rust `::`-path resolver (Self, type members, module files)
│   ├── callable_instance.python.ts  # Python __call__ callable-instance resolution
│   ├── collection_dispatch.ts    # Collection-stored function dispatch
│   ├── container_element.ts      # The type one element read out of a container binding holds
│   ├── namespace_member.ts       # The member a namespace hop names (namespace block body, whole-module import exports)
│   ├── subtype_dispatch.ts       # Which files a pass's lookups dispatched through which types' subtype closures
│   ├── type_token_return.ts      # Generic return inferred from a type-token argument
│   ├── value_source.ts           # What a binding holds: an instance, a class object or a callable
│   └── receiver_resolution.ts    # Receiver type inference (unified base + property-chain walk)
├── type_preprocessing/           # Type metadata extraction from definitions and references
│   ├── index.ts                  # type_preprocessing barrel
│   ├── annotation.ts             # Annotation parser (marshaller): text → head name chain + type arguments
│   ├── annotation.{javascript,python,rust,typescript}.ts  # Per-language annotation grammars
│   ├── annotation_syntax.ts      # Bracket-aware splitting shared by the grammars
│   ├── bindings.ts               # Value bindings (variable/parameter/property) and return bindings (function/method), keyed by SymbolId
│   ├── class_object_shape.ts     # The annotations that denote a class object (`type[X]`, `typeof X`)
│   ├── constructor_bindings.ts   # Constructor call name-chain bindings, for a binding's value and for its element
│   └── container_shape.ts        # The closed container shapes and which type argument is their element
└── import_resolution/            # Cross-file import path resolution
    ├── index.ts                  # import_resolution barrel
    ├── import_graph.ts           # ImportGraph (import dependency tracking)
    ├── module_specifier_index.ts # Package/crate name → its directory or entry file: tsconfig `paths` + `extends` chains, package `exports` maps, Cargo crate roots
    ├── import_resolution.ts      # Marshaller (language switch)
    └── import_resolution.{javascript,python,rust,typescript}.ts  # Language-specific resolvers
```

## Key Types

- **`ResolutionRegistry`** — Thin wrapper coordinating Phase 1 and Phase 2; holds `ResolutionState`
- **`ResolutionState`** — Immutable state: `{ resolutions_by_scope, scope_to_file, resolved_calls_by_file, calls_by_caller_scope, indirect_reachability, subtype_dispatch_files }`. `subtype_dispatch_files` maps each class or interface to the files holding a call, getter read or callable-value read whose lookup enumerated its subtype closure — resolved or not — replaced per file whenever that file resolves and evicted with it.
- **`DefinitionRegistry`** — Central definition store with indexes by symbol, file, location, scope, same-scope rebinding and member, composing the heritage graph it resolves
- **`TypeRegistry`** — Resolved type relationships: value types, value type arguments, container elements, callable return types, callable class-object returns, type members; walks inheritance over the heritage graph
- **`ScopeRegistry`** — Persists scope trees from `SemanticIndex` for cross-file scope lookups
- **`ExportRegistry`** — Tracks exports per file for import resolution
- **`ReferenceRegistry`** — Stores raw references per file (source of truth for call resolution)

## Resolution State Immutability

Resolution state is stored in an immutable `ResolutionState` object. All resolution operations are pure functions that take state as input and return new state. The `ResolutionRegistry` wraps this pattern.

## Incremental Updates

When a file changes, the `Project` class:

1. Re-indexes the file (`index_single_file`)
2. Updates all registries (`definitions`, `types`, `scopes`, `exports`, `references`)
3. Re-resolves the changed file + its dependents (files that import from it)
4. Re-resolves the calls of every file that dispatched through a type whose subtype closure the change altered. Two changes alter it: a parent gaining or losing a subtype edge — `resolve_type_heritage`, or `take_evicted_heritage_parents` on removal — and a type whose members a file contributes differently — `take_changed_member_types`, which compares a file's contributions against the ones it held before its latest eviction, so a member added, removed or moved to a new symbol counts. The project widens those types to every type above them (`DefinitionRegistry.get_supertype_closure`) and reads `ResolutionRegistry.get_files_dispatching_through` for the files to re-answer. A caller that names only the interface imports neither the implementer nor anything it touches, so the import graph cannot find it; the index can, which is what makes an incremental load resolve the same as a bulk one whatever order the interface, implementer and caller arrive in, and keeps a caller's targets on the implementer's live members through edits to it.

## Hook Enforcement

Naming is hook-enforced by `file_naming_validator.ts` — see `@.claude/rules/file-naming.md`.
`import_resolution/` is the reference marshaller shape: `@.claude/rules/language-patterns.md`.
