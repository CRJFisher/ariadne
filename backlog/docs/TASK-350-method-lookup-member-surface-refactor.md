# TASK-350 — Unify member lookup behind one complete member surface

## The defect, stated once

Every confirmed false positive in TASK-350 is the same defect: an **already-resolved** receiver or namespace reaches a member-lookup site that consults only a _subset_ of the real member surface, then returns a terminal miss. Upstream stages (receiver-type inference, name resolution) did their job; the failure is genuinely inside member lookup.

Two structural causes produce the 30 confirmed members:

1. **The per-type member surface is incomplete _and_ duplicated.** `DefinitionRegistry.member_index` is built inline in `definition.ts` (the `update_file` class/interface loop), while `extract_type_members` in `type_preprocessing/member.ts` builds a parallel `TypeMemberInfo` surface consumed by `TypeRegistry`. **Both** omit the constructor-as-named-member (350.1.1) and class-body operator aliases (350.1.3).
2. **The namespace/named-import surface never follows re-export edges.** `resolve_namespace_export` / `resolve_named_import` (in `method_lookup.ts`) stop at direct `is_exported` defs, even though `ExportRegistry.resolve_export_chain` already follows re-export edges correctly with cycle detection (350.1.2).

## The unifying refactor

The project guideline, made executable: **a resolved receiver/namespace must exhaust the member surface before returning a miss.** That decomposes into two structural moves — not three independent patches:

- **(A) One complete per-type surface.** Make `extract_type_members` the _sole_ producer of the per-type member surface (methods + properties + constructor-keyed-by-language-name + operator aliases — all flat `SymbolName → SymbolId`). Build `DefinitionRegistry.member_index` _from_ `extract_type_members` instead of re-deriving members inline. The constructor key and alias keys then become ordinary name-keyed entries that **every** existing consumer discovers for free: the `method_lookup` regular-type fallback, `receiver_resolution.walk_property_chain`, polymorphic dispatch, and the constructor-linkage site. Completing the data once fixes 350.1.1 and 350.1.3 at every site.

- **(B) One re-export follower at the namespace boundary.** Route the namespace/named-import branches through the canonical `ExportRegistry.resolve_export_chain`. The namespace boundary's "surface" is the export graph rather than a type's members, but it honors the same contract — exhaust the surface before a miss (350.1.2).

**No new `exhaust_member_surface()` indirection is introduced.** The existing `member_index` fallback in `resolve_method_on_type` (and the byte-identical one in `receiver_resolution.walk_property_chain`) already _is_ that surface once the data is complete. We complete the data rather than add a layer (YAGNI).

## Workstreams

### WS1 — Collapse the two member surfaces into one complete builder

_Serves 350.1.1, 350.1.3. Land first: it defines the data contract everything else reads._

- `packages/types/src/symbol_definitions.ts`: add `readonly member_aliases: ReadonlyMap<SymbolName, SymbolName>` to `ClassDefinition` (alias_name → target_member_name), **non-nullable, empty-map default**. Adding the field with an empty default in WS1 keeps WS1's alias-expansion code compiling and live (not dead) before WS2 populates it.
- `packages/types/src/index_single_file.ts`: **drop** the separate `constructor?: SymbolId` field from `TypeMemberInfo`. The constructor becomes an ordinary key in the member map under its language-specific name. NO BACKWARDS COMPAT — update every reader.
- `packages/core/src/resolve_references/type_preprocessing/member.ts`: in the `extract_type_members` class loop, after indexing methods/properties: **(a)** fold the constructor in under its **language-specific** runtime name (see the constructor-name invariant below); **(b)** expand aliases — for each `[alias_name, target_name]` in `class_def.member_aliases`, resolve `target_name` against the methods/properties already indexed and set `alias_name → target_symbol`. Remove the `constructor:` field from the returned object.
- `packages/core/src/resolve_references/registries/definition.ts`: in `update_file`, **replace** the inline `flat_members` construction for class/interface with a single call into the same extraction logic, so `member_index` is built from `extract_type_members` output (constructor + alias keys appear automatically). Keep the separate `by_symbol` / `location_to_symbol` registration of methods/properties/constructors — those are different indexes. This deletes the duplicated member-derivation.
- `packages/core/src/resolve_references/registries/type.ts`: update `get_type_member` (and any reader) that consults `TypeMemberInfo.constructor` to read the constructor from the member map instead.
- **Tests in `member.ts`/`definition.ts`'s test files updated in this same workstream** (see Test strategy).

### WS2 — Per-language class-body alias extractor (upstream source for 350.1.3)

_Serves 350.1.3. Land second: populates `ClassDefinition.member_aliases` so WS1's expansion produces keys._

- New per-language metadata extractors under `index_single_file/query_code_tree/metadata_extractors/`:
  - `class_member_aliases.python.ts` — class-body guarded literal name-binding assignments where RHS is a bare identifier naming a sibling member (`__getitem__ = _getitem`, including `if not TYPE_CHECKING:` / conditional-wrapped literal form).
  - `class_member_aliases.typescript.ts` — TS class-body `x = y` literal aliases.
  - `class_member_aliases.rust.ts` — impl-block literal aliases (covers Rust `eq_impl`-style self-method misses).
- **Wire each extractor into the class symbol factory** so `ClassDefinition.member_aliases` is populated at index time. Guard **strictly** to a literal identifier RHS naming an existing sibling member (no computed/dynamic forms) per YAGNI. A language whose AST has no such form returns an empty map.
- **Resolve open question O1 before coding:** confirm `ClassDefinition` carries enough class-body AST to read these assignments at index time. If not, WS2 expands to thread the assignment-node capture from the tree-sitter query pass into the factory.

### WS3 + WS4 — Make namespace/named-import branches follow re-export chains

_Serves 350.1.2. Land as one change — WS3's signature change forces WS4's threading. Independent of WS1/WS2._

**WS3 (the resolver collapse):**

- `method_lookup.ts`: change `resolve_namespace_export` to accept `exports: ExportRegistry`, `languages: ReadonlyMap<FilePath, Language>`, `root_folder: FileSystemFolder`; after the existing direct-definition scan misses, delegate to `exports.resolve_export_chain(source_file, export_name, "namespace", languages, root_folder)`. This fixes both the namespace branch and the submodule fallback (the fallback benefits automatically from the signature change — no separate edit there).
- `method_lookup.ts`: **delete** `resolve_named_import` and route the named/default branch through `resolve_export_chain`, removing the duplicated `def.kind === "import"` skip logic. **Before deleting, diff** `resolve_named_import`'s current name-matching against `resolve_export_chain`'s default-export keying (`${file}:default`) to confirm no silent default-import behavior change; add a regression test if they differ (open question O2).

**WS4 (thread export context to every call site):**

- Extend `ReceiverResolutionContext` (`receiver_resolution.ts`) with `readonly exports`, `readonly languages`, `readonly root_folder`.
- Thread the three values through `method_call.ts` (`resolve_method_call`), `call_resolver.ts` (`CallResolutionContext`), `resolve_references.ts` (`resolve_calls_for_files` wrapper), and `project.ts` (pass `this.exports`, the already-built `languages` map, and `root_folder` at the `resolve_calls_for_files` call). All three already exist on the `Project`; this is mechanical plumbing.
- **`registries/type.ts`**: the `resolve_namespace_export` call here is outside the call-resolution context — thread the export context through `TypeRegistry.update_file`, or route this call through a context-carrying forwarder. Do not leave it on the old signature.
- **`call_resolution/constructor.ts`**: its `resolve_namespace_export` call must also pass the new context. Add to files-touched.
- **Verify `ExportRegistry` lifecycle:** confirm `exports.update_file` runs _before_ call resolution in the pipeline (so the export graph is populated when `resolve_export_chain` is consulted). If not, this is an ordering fix, not just plumbing.

### WS5 — Constructor linkage fallback at the resolve point

_Serves 350.1.1. Land last: depends on WS1 keying the constructor in `member_index`._

- `call_resolution/constructor.ts`: in `resolve_constructor_call`, when `find_constructor_in_class_hierarchy` returns null, consult `definitions.get_member_index().get(class_symbol)?.get(<lang ctor name>)` (now populated by WS1) **before** the `|| class_symbol` terminal fallback. `find_constructor_in_class_hierarchy` already walks the inheritance chain, so this fallback only handles the class whose own/inherited explicit constructor was not linked; `class_symbol` remains the terminal fallback for classes with no explicit constructor anywhere.
- `method_lookup.ts`: **no new branch** — the existing `member_index` fallback now finds the constructor key for `resolve_method_on_type(class_id, '__init__'|'constructor'|'new')`.

## The constructor-name invariant (load-bearing)

The design keys the constructor in `member_index` under its **language-specific runtime name** (`__init__` Python, `constructor` TS, `new` Rust). `ConstructorDefinition` carries only `name: SymbolName` with no language marker, and that name is _not_ guaranteed to already be the runtime invocation name. **WS1 must compute the language-specific constructor key explicitly** (e.g. a `get_language_constructor_name(class_def, language)` helper in `definition.ts`) rather than trusting `ConstructorDefinition.name`. This is the invariant the whole single-surface design leans on — assert it per language (O3).

Why it is collision-safe: constructor names are language-reserved and cannot equal an ordinary user method name; interfaces never receive a constructor key (class-only). So polymorphic dispatch and interface dispatch are unaffected.

## Test strategy

All assertions use `toEqual` against typed literal objects/Maps — never `toMatchObject`, never weak existence checks; test `is_exported` true **and** false on owning classes. Add to existing test files.

- **`member.test.ts` (WS1+WS2):** `extract_type_members` on a Python class with `__init__` → member map contains key `"__init__"` → ctor `SymbolId`, and **assert no separate `constructor` field remains**; repeat for TS `constructor` and Rust `new`. Interface → no constructor key. Class with `__getitem__ = _getitem` (plain **and** `if not TYPE_CHECKING:` guarded) → both `"_getitem"` and `"__getitem__"` map to the same symbol. Negative: computed/non-literal RHS produces no alias. **Update the existing `.constructor`-field assertions** (the field is gone).
- **`definition.ts` test file (WS1):** after `update_file`, the class's `member_index` contains the constructor key and both alias keys — `toEqual` on full Map contents.
- **`constructor.test.ts` (WS5):** class with explicit ctor resolves; class with no own ctor but parent has one resolves via hierarchy; class with no ctor anywhere falls back to `class_symbol`.
- **`method_lookup.test.ts` (WS3+WS5):** `resolve_method_on_type(class_id, ctor_name)` returns the ctor via `member_index` fallback; interface lookup for `"constructor"` still misses; namespace import where the source barrel re-exports `export { foo } from './x'` resolves `foo` through `resolve_export_chain`; `export * from './x'` star re-export resolves; **cyclic** re-export is _detected_ (visited set) and returns a clean `method_not_on_type` miss — not an exception or loop; direct (non-reexport) export still resolves (no regression). These need a **real `ExportRegistry` + `languages` + `root_folder`** — update the mock-based setups to construct them (use `Project` + temp-dir or inline `update_file`).
- **Per-language constructor-name invariant tests:** assert each language's `ConstructorDefinition` keys under the runtime ctor name.
- **Integration (Project + `update_file` inline / fixtures):** django `ChangeList(...)`/`WSGIRequest(...)`/`BaseCommand()`; TS `import * as ts; ts.foo()` barrel + `FourSlash.*`; sqlalchemy/pandas `__getitem__ = _getitem`; Rust `eq_impl`; `DataFrame.to_parquet` — confirm the previously-missed 14+10+6 members resolve and nothing prior-passing regressed.

## Sequencing

1. **WS1 first** — defines the type/shape contract (no separate `TypeMemberInfo.constructor`; `ClassDefinition.member_aliases` empty-default; `member_index` built from `extract_type_members`). Constructor folding works immediately; alias expansion is live but produces nothing until WS2. Land + test the constructor case alone.
2. **WS2 second** — populates `member_aliases`; test 350.1.3 end-to-end. Resolve O1 before coding.
3. **WS3 + WS4 together** — one change (signature + threading), or the build breaks. Independent of WS1/WS2. Resolve O2 and the lifecycle check before landing.
4. **WS5 last** — depends on WS1's constructor keys; verifies django direct-instantiation cases.

**350.1.4 (interim triage classifier mitigation)** is out of scope for this code plan — authored by the human registry owner per the classifier-lifecycle write-boundary contract, as a parallel deliverable.

## Files touched

`packages/types/src/symbol_definitions.ts` · `packages/types/src/index_single_file.ts` · `resolve_references/type_preprocessing/member.ts` (+ test) · `resolve_references/registries/definition.ts` (+ test) · `resolve_references/registries/type.ts` · `resolve_references/call_resolution/method_lookup.ts` (+ test) · `resolve_references/call_resolution/constructor.ts` (+ test) · `resolve_references/call_resolution/receiver_resolution.ts` · `resolve_references/call_resolution/method_call.ts` · `resolve_references/call_resolution/call_resolver.ts` · `resolve_references/resolve_references.ts` · `project/project.ts` · 3× new `index_single_file/query_code_tree/metadata_extractors/class_member_aliases.{python,typescript,rust}.ts`

## Risks & mitigations

- **Hot-path cost** — `member_index` now built from `extract_type_members` on every incremental edit. Still O(members) plus a bounded alias pass; no extra project-graph traversal. Benchmark a large fixture re-index before/after.
- **Dropping `TypeMemberInfo.constructor` (NO BACKWARDS COMPAT)** — breaks every reader. Grep `.constructor` on `TypeMemberInfo` consumers (`type.ts get_type_member`, `receiver_resolution`, inheritance walks) and the test mocks; update each. Intended cost of removing the parallel path.
- **Over-broadening polymorphic dispatch** — keying the constructor as a member could let `resolve_polymorphic_class_method` return base + overriding constructors for a ctor-named lookup. This matches method-override behavior and is desired for constructor-chaining; add a test asserting it. Collision with user methods is impossible (reserved names; class-only).
- **Re-export traversal cost** — `resolve_export_chain` already has visited-set cycle detection; real barrels are 1–2 hops.
- **Alias-extractor index bloat** — strictly guarded to literal identifier RHS naming an existing sibling; dynamic forms stay unresolved.

## Open questions (resolve before the relevant workstream lands)

- **O1 (WS2):** Does `ClassDefinition` carry enough class-body AST for the alias extractors to read literal assignments at index time, or must raw assignment nodes be threaded from the tree-sitter query pass into the class symbol factory?
- **O2 (WS3):** Does deleting `resolve_named_import` change default-import name-matching for any fixture relying on `export default class X` matched by name rather than default-export metadata? `resolve_export_chain` keys default by `${file}:default`.
- **O3 (WS1):** Confirm per-language `ConstructorDefinition.name` (or the computed key) is always the runtime ctor name; back it with per-language invariant tests.
- **DRY opportunity (WS1):** the two byte-identical member-lookup fallback sites (`method_lookup` regular-type branch and `receiver_resolution.walk_property_chain`) could be extracted into one `lookup_member(definitions, types, type_id, name)` helper, making the single-surface seam explicit. Leaning yes, as part of WS1.
