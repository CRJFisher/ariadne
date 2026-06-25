# TASK-351 — Dispatch-Channel Reachability: Entry-Point Classification Refactor

## 1. Problem and root cause

`detect_entry_points` declares a function an entry point on a single structural fact: the symbol
has no resolved incoming call edge (`trace_call_graph/trace_call_graph.ts:109-138`). A large,
recurring class of _reachable_ functions is invoked through channels the static call graph
cannot represent — framework/runtime dispatch tables, decorator registration, test and benchmark
runners, stored runtime callables, browser/DOM and template bindings, and compile-time codegen.
None of these produce an in-repo call expression, so every such function surfaces as a
false-positive entry point.

Today each pattern is patched by an ad-hoc per-language builtin. There are 65 builtins
(`classify_entry_points/builtins/`), skewed ~38 TypeScript / ~22 JavaScript / 1 Python / **0
Rust**. That skew _is_ the bug: each dispatch channel is re-implemented per language, each builtin
inlines its own `detect_language(...) === 'typescript'` guard and its own copy of
`extract_decorator_block`, and the patterns that were never ported leak through. The canonical
example: anonymous-closure suppression exists only for TypeScript
(`check_higher-order-function-callback.ts:15`), so 67 Rust/Python/Serde closures are reported as
entry points. The builtin table also carries flat duplicates
(`check_inline_callback` ≡ `check_higher-order-function-callback`;
`check_framework-decorator-dispatch` ≡ `check_framework-lifecycle-dispatch`).

The 65 builtins are two distinct populations:

- **~20 dispatch-channel suppressors** — the symbol is genuinely invoked through a
  non-call-expression channel; no static edge can ever exist. **These are TASK-351's scope.**
- **~40 resolver-miss one-offs** — a real call expression exists but the resolver dropped the
  edge (diagnosis `callers-in-registry-unresolved` / `callers-not-in-registry`). These are the
  ~207 mis-routed members fixed upstream in the resolver. **Explicitly out of scope** — they must
  not be absorbed into the dispatch axis, or the classifier starts masking resolver regressions.

**Why more builtins is the wrong shape.** The two classifier mechanisms already differ in cost.
The predicate DSL (`predicate_evaluator.ts`) is declarative, shares one evaluator, is exhaustively
type-checked, and is language-general by construction (a rule has a language clause only if it
writes one). Builtins are arbitrary per-rule TypeScript with hand-inlined language guards. The
language-general axis TASK-351 calls for maps onto **a small data record plus a few declarative
predicate operators**, not onto more imperative builtins. Collapsing dispatch builtins into
declarative rules also _shrinks_ the auto-generated `builtins/index.ts`.

All 266 confirmed members share one signature: `diagnosis === 'no-textual-callers'` with **no**
`resolution_failure`. So `grep_call_sites` is empty and there are no `ariadne_call_refs` — every
call-site-keyed signal (`resolution_failure_reason_eq`, `receiver_kind_eq`,
`syntactic_feature_eq`) is uniformly empty for this cohort. Classification must therefore key on
**definition-site signals** (name, path, decorators) or on a **new bare-reference signal** — never
on call-ref diagnostics. This is the structural fact the design is built around.

## 2. Target architecture — the dispatch-channel reachability axis

The axis is **first-class data on the candidate plus a closed predicate vocabulary that reads it**.
No new classification engine, no second code path running outside the registry: the existing
`predicate_evaluator` + registry + permanent-slice machinery _is_ the axis, which keeps the
triage / plan / reconcile-registry lifecycle (`.claude/rules/classifier-lifecycle.md`) unchanged.

### 2.1 `DispatchSignals` — the shared, language-general candidate record

Add `dispatch_signals: DispatchSignals` to `EnrichedEntryPoint`
(`packages/types/src/entry_point.ts`), _separate from_ `DefinitionFeatures` (which is JS/TS-gated
by contract — mixing them would re-inherit the gate that is the bug). All six sub-patterns key on
this one record:

```ts
interface DispatchSignals {
  is_anonymous: boolean; // === name === '<anonymous>', language-general
  decorators: readonly string[]; // structured DecoratorDefinition.name[], [] when none
  bare_reference_sites: readonly BareReferenceSite[]; // value-read (non-call) sites, [] when none
}

interface BareReferenceSite {
  file_path: FilePath;
  line: number;
  context:
    | "assignment_rhs"
    | "call_argument"
    | "collection_element"
    | "unknown";
}
```

**The load-bearing design rule (grafted from the AXIS-FIRST design's strongest idea):**
`DispatchSignals` carries **only positive dispatch evidence** and deliberately **omits**
`resolution_failure`, `receiver_kind`, and `ariadne_call_refs`. A resolver-miss fingerprint is
therefore _inexpressible_ over `DispatchSignals` — the scope boundary in §1 is enforced by the
type surface, not by reviewer discipline. Dispatch rules gate on a _present_ signal
(`is_anonymous` / a decorator name / a bare reference), never on the mere absence of a resolved
edge, so resolver misses (which carry `resolution_failure` or grep hits) can never match.

### 2.2 The predicate vocabulary

Add language-general leaf ops to `PredicateExpr` + `PREDICATE_OPERATORS`
(`packages/types/src/known_issues.ts:122-172`) and to the exhaustive switch in
`predicate_evaluator.ts:29-119` (tsc forces every addition; regex ops also extend
`clone_expr_with_compiled_pattern` in `registry_loader.ts:98-137`):

| Op                              | Reads                                                  | Serves           |
| ------------------------------- | ------------------------------------------------------ | ---------------- |
| `is_anonymous { value }`        | `dispatch_signals.is_anonymous`                        | 351.1.2          |
| `decorator_name_in { names[] }` | `dispatch_signals.decorators` (exact structured names) | 351.1.3, 351.1.4 |
| `has_bare_reference { value }`  | `dispatch_signals.bare_reference_sites` non-empty      | 351.1.1          |
| `path_matches { pattern }`      | `file_path`                                            | 351.1.5, 351.1.6 |
| `name_matches { pattern }`      | `name`                                                 | 351.1.5, 351.1.6 |

`decorator_name_in` replaces the brittle text-based `decorator_matches` /
`extract_decorator_block` path, which mis-handles multi-line `#[cfg(test)]` and decorator args —
the exact reason the existing Rust `rust-macro-invocation-call` regex never matched the attribute
form (351.1.4). The framework decorator name-set lives as **registry data**, so adding a
PyTorch/NestJS/Fastify decorator is a registry edit, not a code change.

### 2.3 Where the signals are born — the extract stage

`extract_entry_point_diagnostics.ts` already turns each candidate into an `EnrichedEntryPoint`.
Add one function, `derive_dispatch_signals(node, bare_ref_index)`, called per candidate alongside
`derive_definition_features` (line ~168). It is a **separate** function from
`derive_definition_features` precisely so it never inherits the `is_jsts` gate (line 589):

- `is_anonymous` — pure read of `node.name` (`anonymous_function_symbol` already names Rust/Python
  closures `<anonymous>`: `symbol.ts:159-162`, `symbol_factories.python.ts:243,255`,
  `symbol_factories.rust.ts:554`). Zero new computation; only un-gating.
- `decorators` — `node.definition.decorators?.map(d => d.name) ?? []`. The indexer already populates
  `FunctionDefinition.decorators` / `MethodDefinition.decorators` for TS/Python/Rust
  (`symbol_definitions.ts:53,75,91`) and they ride on `CallableNode.definition`; they are dropped
  today at `extract_metadata` (`extract_entry_point_diagnostics.ts:249-263`), which copies only
  `is_exported`/`access_modifier`. This is pure projection, no resolver work.
- `bare_reference_sites` — read from a new value-read index (§2.4).

### 2.4 The one expensive signal — bare references (351.1.1)

The dominant 91-member bucket needs sites where the symbol's name appears as a _value read_
(assignment RHS, argument, collection element) with no following call-paren. No such signal exists:
`build_grep_index` (`extract_entry_point_diagnostics.ts:338-376`) matches only the `identifier(`
call form.

**Chosen approach (Option A — all three designs converge here):** add a second inverted index in
`extract_entry_point_diagnostics`, a bare-identifier index matching `name` _not_ followed by `(`,
scoped to definition-adjacent sites, surfaced as `bare_reference_sites`. This stays inside the
classify stage, is additive, and is reversible.

**Rejected (Option B):** broadening `resolve_references/indirect_reachability.ts:52-105` (which
already computes the `function_reference` / `collection_read` fingerprint). It is method-blind
(`def.kind === 'function'` only, line 87) and is consumed as a _pre-filter_
(`resolution_state.ts:179-182`) — so what reaches classification is exactly its residue, and
widening it shifts which symbols are entry-point candidates at all, a pipeline-wide behaviour
change. YAGNI: ship the hermetic index first; the resolver path is the documented follow-up only
if precision proves insufficient.

### 2.5 Public taxonomy — unchanged

Reuse the existing `KnownIssueClassificationMeta` variants (`classified_entry_point.ts:30-67`) via
`build_classification` (`enrich_call_graph.ts:212-235`): closures and stored callables →
`indirect_only{via}`; framework/registration and codegen → `framework_invoked{framework}`; test
and benchmark → `test_only`. No new public variant. Each rule carries the same classification meta
the retired builtin did, so the verdict consumers see is byte-stable across each retirement.

## 3. Sub-task mapping

| Sub-task                                    | Members | Mechanism                                                                                                                                                                         | New signal?              | Effort  |
| ------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------- |
| **351.1.2** anonymous closures (all langs)  | 67      | `all[diagnosis_eq no-textual-callers, is_anonymous true]`, **no language clause**                                                                                                 | none (un-gate only)      | trivial |
| **351.1.5** ASV benchmark convention        | 14      | `all[diagnosis_eq, path_matches asv_bench/benchmarks/, name_matches ^(time\|mem\|peakmem)_]`                                                                                      | none                     | trivial |
| **351.1.4** Rust `#[test]`/`#[cfg(test)]`   | 20      | `all[diagnosis_eq, decorator_name_in [test, cfg, tokio::test]]`                                                                                                                   | decorators plumbing      | small   |
| **351.1.3** framework/registration dispatch | 75      | `all[diagnosis_eq, decorator_name_in [Query, Resolver, py_impl, register_lowering, …]]` (+ stored-into-table via 351.1.1)                                                         | decorators plumbing      | medium  |
| **351.1.1** stored runtime callables        | 91      | `all[diagnosis_eq, has_bare_reference true]`                                                                                                                                      | **bare-reference index** | large   |
| **351.1.6** residual no-code-caller         | 11      | codegen/string-dispatch → discrete `path_matches`/`name_matches`/`grep_hit_neighbourhood_matches` rules; downstream-only public API → `classifier.kind: 'none'` human known-issue | none                     | medium  |

What makes the split work: 351.1.2 and 351.1.5 are **trivial** because every signal they need is
already on the candidate (closure-ness was always language-general; path and name are present). The
medium tier (351.1.3, 351.1.4) shares **one** decorator-plumbing change. Only 351.1.1 carries new
machinery, and it is isolated last. 351.1.6 is heterogeneous by design — the codegen and
dynamic-string halves are narrow text predicates; the downstream-only public-API case has **no
derivable signal** and is correctly a human known-issue, not automated detection.

**351.1.7 (interim classifiers)** are mitigation only. Each interim `wip` registry rule is retired
(`wip → fixed`) by the human via `reconcile-registry` once its core rule lands — matched by the
fix-commit scope per `.claude/rules/commit-convention.md`. The axis makes the interim rules
redundant channel by channel; core never writes the registry.

## 4. Builtin disposition

**Retired / absorbed (~20)** — deleted file + barrel entry, in the same change that adds the
replacing rule:

- _anonymous-closure_ → `is_anonymous` rule: `check_inline_callback`,
  `check_higher-order-function-callback` (byte-identical dupe), `check_call-apply-dispatch`,
  `check_this-object-method-dispatch`, `check_this-based-method-dispatch`,
  `check_aliased-object-property-call`.
- _framework-registration_ → `decorator_name_in` rules: `check_framework-decorator-dispatch`,
  `check_framework-lifecycle-dispatch` (byte-identical dupe — delete on sight),
  `check_framework-lifecycle-handler`, `check_framework-command-builder-callback`,
  `check_framework-lifecycle-override`.
- _stored-callable_ → `has_bare_reference` rule: `check_stored-callback-via-object-property`,
  `check_this-property-method-dispatch`, `check_dynamic-method-dispatch`.
- _codegen / dynamic-string_ → narrow text/path predicates: collapse the Angular trio
  (`check_angular-generated-instruction-call`, `check_compiler-generated-dynamic-dispatch`,
  `check_string-keyed-dispatch`) into one codegen rule; `check_eval-based-dynamic-dispatch`,
  `check_dynamic-new-function-dispatch`, `check_dynamic-require-constructor`,
  `check_dynamic-dispatch-reporter-constructor`; bundler trio
  (`check_bundler-module-path-substitution`, `check_bundler-module-substitution`,
  `check_dynamic-runtime-injection`) → path predicate.

**Kept distinct** — a different structural axis, not a dispatch channel:
`check_py-dunder-protocol` (Python protocol name-set, no decorator at def site); the
getter/property-read family (`check_getter-accessor-not-tracked`,
`check_property-getter-dispatch`, `check_computed-property-method-caller` — a tree-sitter
no-call-expr capture gap); the private-field-method pair (capture gap).

**Retired upstream, never here** — the ~40 resolver-miss builtins (static-method binding,
constructor linkage, receiver-type-lost, intra-file linkage, type-cast receiver). They have real
call expressions; they belong to the resolver. The `DispatchSignals` type surface (§2.1) makes
them inexpressible as dispatch rules, which is the structural guarantee that they stay out.

Net: `builtins/index.ts` shrinks ~20 entries; the remainder are out-of-scope resolver one-offs and
genuinely distinct narrow predicates.

## 5. Upstream signal changes

Two, both narrowly scoped; only one is on the critical path. **No change** to
`detect_entry_points`, the public taxonomy, or the registry write-boundary.

1. **Decorator projection (medium; serves 351.1.3 + 351.1.4).** Stop discarding
   `node.definition.decorators` at the `extract_metadata` boundary; project the names onto
   `dispatch_signals.decorators`. Pure projection inside the classify stage — no `resolve_references`
   change. Lets us delete the text-based `decorator_matches` / `extract_decorator_block` path.
2. **Bare-reference value-read index (large; serves 351.1.1 only).** §2.4, Option A — a new index
   in `extract_entry_point_diagnostics`, additive, the resolver pre-filter untouched so no candidate
   set shifts. Isolated to the last phase.

## 6. Migration sequence

Incremental and test-gated: at every commit the registry is a valid mix of new declarative rules
and not-yet-retired builtins. Honor NO BACKWARDS COMPATIBILITY — delete absorbed builtins and the
dead text-decorator op outright; no shims.

- **Phase 0 — Regression harness first.** For each of the six sub-patterns, add a fixture under
  `tests/fixtures/{rust,python,typescript}/code/` reproducing the observed evidence (Rust + Python
  closure; ASV `time_*` method; `#[test]` fn; NestJS `@Query` + PyTorch `py_impl`; stored-callback
  field; one codegen case). Assert the exact `EntryPointClassification` via `toEqual` on typed
  literals through `Project` + `update_file`. The new-language cases (Rust/Python anon, `#[test]`)
  **fail here** — they document the gap and become the gate every later retirement keeps green.
- **Phase 1 — 351.1.2 (trivial).** Add `dispatch_signals` + `derive_dispatch_signals` populating
  `is_anonymous` for all languages; add the `is_anonymous` op; author the language-general
  anonymous-closure rule (no language clause), placed above the builtins it subsumes; regenerate
  `permanent_data.ts`. Rust/Python closure cases flip green. Delete the anonymous-closure builtins
  one per commit, re-running the suite between each.
- **Phase 2 — 351.1.5 (trivial).** Add `path_matches` + `name_matches` ops; author the ASV rule.
  No builtin to delete (uncovered gap).
- **Phase 3 — 351.1.3 + 351.1.4 (shared decorator plumbing).** Land upstream change #1; add
  `decorator_name_in`; author the registration rule (name-set as registry data) and the
  `#[test]`/`cfg` rule. Delete the framework-\* builtins (and the byte-identical dupe) one per
  commit. Remove the dead `decorator_matches` op once nothing references it.
- **Phase 4 — 351.1.6 (cheap subset).** Author codegen/dynamic-string rules
  (`grep_hit_neighbourhood_matches` + `name_matches`); record the downstream-only public-API row as
  `classifier.kind: 'none'`. Collapse the Angular trio to one rule. Delete eval/new-Function +
  bundler builtins.
- **Phase 5 — 351.1.1 (large, isolated last).** Land upstream change #2; add `has_bare_reference`;
  author the stored-callable rule; delete the three stored-callable builtins. Can slip without
  blocking Phases 1–4.
- **Phase 6 — Sweep.** Human flips 351.1.7 interim `wip` rules to `fixed` via `reconcile-registry`
  as each core rule lands. Confirm `builtins/index.ts` shrank ~20 entries with no
  `MissingBuiltinError`; `permanent_data.sync.test.ts` byte-matches.

## 7. Test strategy

Three layers, each a retirement gate (per CLAUDE.md: colocated `*.test.ts`, `toEqual` with typed
literals, never `toMatchObject` / `toBeDefined`, both `is_exported` true and false):

1. **Data layer** (`extract_entry_point_diagnostics.test.ts`) — prove the signal arrives. Assert
   `dispatch_signals` exactly: a Rust `#[test] fn` yields `decorators: ['test']`; a Rust closure
   and a Python lambda yield `is_anonymous: true`; a Python `@py_impl(...)` def yields
   `decorators: ['py_impl']`; a stored callback `const h = handler` (no paren) yields a
   `bare_reference_sites` entry with `context: 'assignment_rhs'` but `handler()` does **not**. These
   tests fail before the decorators are un-dropped — they directly guard the regression.
2. **Predicate layer** (`predicate_evaluator.test.ts`) — hand-built `EnrichedEntryPoint` literals;
   each new op returns the exact boolean for match and non-match.
3. **Classify layer** (`classify_entry_points.test.ts` / `enrich_call_graph.test.ts`) — each
   sub-pattern fixture flows the full `Project` pipeline and asserts the public
   `EntryPointClassification` (not `true_entry_point`). The **cross-language matrix** is the
   explicit guard against the language-gate regression: the same closure rule must fire for ts +
   py + rust fixtures.

Plus two invariant guards: a **parity test** that asserts the new rule classifies each fixture into
the same `group_id` as the builtin did _before_ deletion (so a verdict-changing retirement fails
loudly); and a **negative pre-emption test** — a resolver-miss candidate
(`callers-in-registry-unresolved`) must match **no** dispatch rule, enforcing the scope boundary.
`permanent_data.sync.test.ts` stays green after each slice regeneration.

## 8. Risks and open questions

- **Bare-reference false positives (351.1.1).** A name-keyed value-read index also matches shadowing
  locals, comments, and unrelated same-named symbols, over-suppressing real entry points. This is
  the single riskiest detector — sequenced last and isolated. _Mitigation:_ constrain to
  definition-adjacent sites, require `diagnosis === 'no-textual-callers'` as a precondition, and
  ship a fixture with a same-named-but-unrelated symbol that must **not** be suppressed.
- **First-match-wins ordering** (`classify_entry_points.ts:82`). A broad rule placed too high
  pre-empts narrower correct rules; too low, a surviving builtin pre-empts it. _Mitigation:_ cut
  over one channel at a time, deleting absorbed builtins in the same change; the parity test catches
  any `group_id` drift.
- **Decorator name normalization.** `DecoratorDefinition.name` may carry args/namespacing
  differently per language (`@Component()` vs `@app.route('/')` vs `#[cfg(test)]` vs
  `#[tokio::test]`). _Mitigation:_ the data-layer tests pin the exact extracted name per language
  **before** any rule is authored — author rules against observed values, never source text.
- **`is_anonymous` completeness.** If some Rust/Python closure form is not named `<anonymous>` by
  the symbol factories, it leaks. _Mitigation:_ verify against the 67 observed members' actual names
  with multi-form fixtures before declaring 351.1.2 done.
- **Separate-function discipline.** `derive_dispatch_signals` must be its own function and field —
  copy-pasting the `is_jsts` gate from `derive_definition_features` (line 589) would silently
  re-break Rust/Python, the exact bug being fixed. A Rust fixture asserting non-empty `decorators`
  is the tripwire.
- **Open question:** if the Option-A grep index proves too coarse for 351.1.1, escalate to Option B
  (broaden `indirect_reachability` to methods + field/hook/dict storage and surface it on
  `CallableNode`) — a real `resolve_references` change, scoped as a follow-up, not part of this work.
