---
id: TASK-376.1
title: "Mint collection member ids that name real definitions"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - collection_dispatch
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 1000
plan_dedup_keys:
  - 39c2e6c069671d09c53bfdd2a668ef10ea5916a500dc3e25a3e5af50baf474e0
plan_source_tasks:
  - pt-90fd46860b8b967c
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 1. Wave 1 of the epic's Implementation Plan; no dependencies.

## The invariant

A `FunctionCollection` member id must be the id the definition builder mints for the same node, or every downstream collection consumer reads a phantom member: the call through the holder lands on nothing while the real function dangles. The mint sites in `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts` agree with the definition side:

- `detect_member_assignment` mints `function_symbol(name, name-span)` when the value node carries a `name` field and `anonymous_function_symbol(value-span)` otherwise. The anonymous value is a definition because `queries/javascript.scm` and `queries/typescript.scm` capture a function value assigned onto a member as `@definition.anonymous_function` at the value's own span. The two grammars exclude different holders, because their surrounding CommonJS rules differ: JavaScript excludes the `exports` bag, whose values its property-export rules name; TypeScript excludes only the bare `module` holder, since it carries no property-export rule.
- `extract_functions_from_object` mints `method_symbol` on the name node for a `method_definition` — the span `create_method_id` keys the definition on, and only for the key shapes `@definition.method` captures — and the anonymous span for a `pair` whose value is an arrow or function expression, matching the rule that captures a pair's function expression as `@definition.anonymous_function`.

The invariant is pinned at three tiers: inline id equality for every attachment shape in both grammars, a sweep over every collection in the JavaScript fixture corpus, and the express same-file case at the `Project` tier.

## Work plan

1. Add `build_index_single_file` inline assertions with `toEqual` against typed literals for all four shapes: `proto.engine = function engine() {}` records the **named** function's `SymbolId`, equal to the id present in `index.functions`; `proto.run = function () {}` and `proto.go = () => {}` record the anonymous-span id, equal to the id in `index.functions`; an object-literal `pair` with a function-expression value and a `method_definition` member likewise.
2. Add one invariant assertion over the fixture corpus (`tests/fixtures/javascript/code/`): every id held in any `FunctionCollection` (`stored_functions` and every `named_members` entry carrying a `symbol_id`) is present in the index's definitions. This is the assertion that fails if any future mint site drifts.
3. Add the express same-file integration case at the `Project` + `update_file` tier: `lib/application.js`'s `app.engine = function engine(...)` and `app.set = function set(...)` reachable and resolving to their named definitions through the `app` collection. The two-file `require` + `mixin` case belongs to TASK-376.12.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Every id recorded in a `FunctionCollection` resolves to an entry in the definition store; asserted over the fixture corpus, not only over the four inline shapes.
  Evidence: `symbol_factories.javascript.test.ts` › "collection member ids name real definitions" › "names a definition with every id any collection in the JavaScript fixture corpus records" — 31 files, 62 recorded ids, zero phantoms. On the base tree the same sweep reports 24 phantoms out of 29 recorded ids (17 shorthand methods keyed on the whole `method_definition` span, 7 member-assigned anonymous functions with no definition at all).
- [x] #2 Express's `app.engine` / `app.set` named member-assigned functions are reachable and resolve to their named definitions in the same file.
  Evidence: `resolve_references.javascript.test.ts` › "Named functions assigned onto an object in the same file" › "resolves every call through app to the call-graph node the assignment defined", over `tests/fixtures/javascript/code/integration/express_application.js`. Each of `app.init()`, `app.set(...)`, `app.engine(...)` and `app.render(...)` is compared against the whole `SymbolId` of the call-graph node at the assignment's own line — the call graph holds a node only for a callable the definition store carries, so a phantom id or a location-keyed twin fails the assertion. None of `engine`, `set`, `init` is an entry point. The test fails on the base tree: no node exists at the `app.render` assignment there.
- [x] #3 Anonymous and arrow member assignments, object-literal `pair` members and `method_definition` members record the id the definition builder mints (asserted by id equality, not by resolution alone).
  Evidence: the inline cases in the same describe pin the exact `SymbolId` each collection records and its presence among the index's definitions, every id built with the same factory the production code uses (`function_symbol` / `method_symbol` / `anonymous_function_symbol`): `proto.engine = function engine() {}` → the named definition's id at the name node; `proto.run = function () {}` and `proto.go = () => 2` → the anonymous ids at the value spans, now present in `index.functions`; `{ short() {}, long: function () {}, arrow: () => 3 }` → the method id at the name node and the two anonymous ids. Two further cases pin the boundaries: an object-literal key no `@definition.method` capture reaches (`'my-key'() {}`, `1() {}`) records no member at all, and the CommonJS bag keeps its single definition at the property node with the nested `exports.hidden = () => 2` recording none. The anonymous and object-literal cases fail on the base tree.
- [x] #3b The same invariant holds in TypeScript.
  Evidence: `symbol_factories.typescript.test.ts` › "collection member ids name real definitions (TypeScript)" — `app.engine = function () {}` records the value-span id in both `stored_functions` and `named_members` and that id is present in `index.functions`; `exports.handler = async () => {}` gets the definition no other rule in that grammar names; `module.exports = function () {}` keeps the single definition its own rule already made. The first two fail on the base tree.
- [x] #4 `collection_dispatch.test.ts` and `method_lookup.test.ts` stay green.
  Evidence: the full core suite passes with `tsc --noEmit` and `pnpm lint` clean. Both files build their registries from hand-written definition literals rather than indexing source, so their greenness is a regression check on the resolution logic, not on mint-site identity; the guard that a consumer still reaches a real definition is criterion #2's Project-tier case.

<!-- AC:END -->

## Implementation Notes

## High-level summary

A call through an object onto which a function was assigned now lands on that function: `app.render(...)` where `app.render = function () {}` reaches the function the assignment defined, and that function's own calls enter the call graph instead of dangling. The same holds in TypeScript, where a CommonJS `exports.handler = async () => {}` becomes a callable the graph can reach at all. What makes it work is one invariant — every id a `FunctionCollection` records is the id the definition builder minted for the same node — pinned at three tiers so a future mint site cannot drift away from it silently.

Start at the "collection member ids name real definitions" describe in `symbol_factories.javascript.test.ts` for the shapes, its TypeScript twin in `symbol_factories.typescript.test.ts`, and the member-assignment rule in `queries/javascript.scm` and `queries/typescript.scm` for the capture.

### What disagreed, and the root fix for each

Measured on the tree at `279221d4`, three of the attachment shapes recorded ids no definition carried, from two mint sites; the named-function-expression shape and the object-literal `pair` shapes already agreed.

- `extract_functions_from_object` keyed an object-literal shorthand method on the whole `method_definition` span while `create_method_id` keys it on the name node. The collection now keys on the name node. It also records a member only for the three key shapes `@definition.method` captures, so a quoted or numeric key — `{ 'my-key'() {} }` — records nothing rather than an id no builder mints.
- A function value assigned onto a member was never captured as a definition, so `app.run = function () {}` recorded an id nothing minted. `javascript.scm` and `typescript.scm` now capture the assigned value as `@definition.anonymous_function` at its own span — the span `detect_member_assignment` already keys on.

### What each query excludes, and why the two files differ

`javascript.scm` excludes the `exports` / `module` / `module.exports` holders: the CommonJS property-export rules above it already define those values under their exported names. The exclusion and the property-export rule read the holder the same whitespace-tolerant way, so a holder written `module\n  .exports` is excluded here and defined there, exactly as the single-line form is. Reading it two different ways is what would break: a text-exact exclusion mints a value-span definition whose parameters bind to the property-node id `is_commonjs_exports_base` hands the parameter pass, leaving the definition with an empty signature.

`typescript.scm` excludes only the bare `module` holder, because the whole-module `module.exports = fn` rules are the sole `exports` rules that file carries — it has no `@definition.function.commonjs_export` rule at all. Excluding `exports` there would have suppressed the only definition a `.ts` file's `exports.handler = () => {}` could get, on the strength of rules that exist only in the JavaScript grammar.

### The widened definition set

The rule matches a member assignment onto any holder, while `detect_member_assignment` records a collection member only for a bare identifier holder or `X.prototype`. So `this.handler = function () {}` and `a.b.c = function () {}` now produce a definition that no collection references. That is deliberate and one-directional: the invariant is that every *recorded* id names a definition, not that every definition is recorded. Standing on its own still puts the function's body in the call graph, and an anonymous callable is never reported as an entry point.

### The callback boundary

Making the assigned value a definition exposed a defect in `detect_callback_context`: its upward walk did not stop at a callable boundary, so a function merely *written inside* a callback body was labelled a callback of the enclosing call. `register(function (req) { app.m = function () {} })` put an edge in the graph saying `register` invokes `app.m`, which nothing does — and anything `app.m` called then looked reachable from the receiver's caller. The walk now stops at the first enclosing callable, so a callable is a callback only of the call it is written directly inside. This also corrects the same mislabelling for a function *returned* from a callback. The verbatim copy of `detect_callback_context` in `symbol_factories.typescript.ts` is deleted in favour of a re-export of the JavaScript one, as that file already does for `detect_function_collection` — a second copy would have kept the defect in TypeScript.

### Generated fixtures

The JavaScript goldens under `tests/fixtures/javascript/index_single_file/` record the index each fixture produces. This change alters four of them and adds one for the new fixture; those five are regenerated. The other seven JavaScript goldens carry drift that predates this change — a regeneration on the base sources rewrites them too, by 1,085 lines, mostly definitions added by rules that landed after the goldens were last written. That drift is left alone here rather than folded into this step's diff; nothing asserts against the goldens, so it is invisible until someone regenerates.

### Known gaps

- `exports.x = () => {}` written inside a function body records no definition in JavaScript: the top-level CommonJS rules are anchored at `(program (expression_statement …))` and the member-assignment rule excludes the `exports` holder, and the query cannot tell that position from the top-level one it must exclude.
- A file that *declares* its own `exports` or `module` binding still records a phantom member. With `var exports = module.exports = {}`, the CommonJS rule defines the value at the property span while `detect_member_assignment` records the value span; with a local `module`, the query excludes the holder alongside the real CommonJS bag while `detect_member_assignment` still records `module.foo`, and nothing defines it. No fixture has either shape, so the corpus sweep does not see them. Pre-existing, and untouched here — closing them means teaching `detect_member_assignment` to mint the property-node id for a CommonJS holder and to skip a bare `module` one.
- A generator value (`X.prototype.gen = function* () {}`) and a compound assignment (`o.h ||= function () {}`) are matched by neither the query nor `detect_member_assignment`. Because both sides skip them there is no phantom; the cost is that a call through the holder cannot resolve.
- An object literal written inside a class method has its shorthand methods attributed to the enclosing class by `find_containing_class`. The ids agree, so the sweep passes, but the method is registered on the wrong owner. Pre-existing.
