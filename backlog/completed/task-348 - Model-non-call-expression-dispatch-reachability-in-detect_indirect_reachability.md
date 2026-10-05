---
id: TASK-348
title: "Model non-call-expression dispatch reachability in detect_indirect_reachability"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
priority: high
plan_dedup_keys:
  - 5a7523de87fbd48bf7f46da7ea0b41cf910596781bc9693fc729faa39c04c4a0
plan_source_tasks:
  - pt-9770be4dbff8b73b
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. Add a `field_store_read` variant to `IndirectReachabilityReason` (`@ariadnejs/types`, consumed at `packages/core/src/resolve_references/indirect_reachability.ts:11`) alongside `function_reference` and `collection_read`. Additive change; do not bump `schema_version` (the self-healing pipeline persists no data) — update fixtures only.

2. Widen the value-reference arm in `indirect_reachability.ts:86-101`: replace the `def.kind === "function"` gate with `def.kind === "function" || def.kind === "method" || def.kind === "constructor"` so a bound-method or static-method reference passed as a value marks the method reachable. Keep the definition-site self-reference skip at lines 90-96. Covers `self._acquire_connection`, `self.on_node_start`, `process.stdout.write = this.write.bind(...)`, `addEventListener(elementMouseOver)`.

3. Add a closure arm: when the resolved `def` is an anonymous function (`name === "<anonymous>"`) and its definition carries a callback/argument context, mark it `function_reference`-reachable unconditionally. Confirm the TS/Python closure handlers (`capture_handlers.typescript.ts:395-410`, `capture_handlers.python.ts:406-421`) surface a callback context onto the stored definition equivalent to Rust's `callback_context` (`capture_handlers.rust.ts:864`); thread it onto the definition in `definitions.ts:add_anonymous_function` if not yet surfaced. If the context flag proves unreliable, key the arm on `name === "<anonymous>"` alone (closures are never true entry points).

4. Add a field-store arm: when a reference reads a function/method symbol that flows into an object/class field initializer (assignment-RHS, shorthand-property, `.bind(this)` shapes), record `field_store_read`. Gate conservatively — require the read to flow into a field initializer or a known callback-registration argument position, not any bare mention — to avoid suppressing a genuinely-dead function. Covers `createPrismaPromise`, `_set_single_rebuild`, `this._processor`.

5. Delete the two TypeScript-only anonymous-closure builtins `builtins/check_higher-order-function-callback.ts` and `builtins/check_inline-callback.ts` (subsumed by the language-general closure arm), and `builtins/check_stored-callback-via-object-property.ts` (subsumed by the field-store arm). Regenerate the builtin barrel and `packages/core/src/classify_entry_points/permanent_data.ts` via the existing `generate_permanent_data.ts` flow.

6. Confirm `get_indirect_reachability` consumers (`indirect_reachability.test.ts`, `CallGraph.indirect_reachability` at `trace_call_graph.ts:171`) tolerate the new `field_store_read` reason variant. `enrich_call_graph.build_classification` and the classifier orchestration need no edit — shrinking the entry-point set upstream is transparent.

7. Tests: AST-level `build_index_single_file()` cases asserting closure definitions carry a callback context per language (Rust `Option::map(|x| ...)`, Python `lambda`, TS arrow-as-arg); `Project` + `update_file()` cross-file cases asserting (via `toEqual` over typed entry-point-set literals) that a higher-order closure, a bound/static method passed by reference, and a method-reference stored into a field are all removed from entry points. Extend `indirect_reachability.test.ts` for the new reason; keep `permanent_data.sync.test.ts` byte-locked after barrel regen.

8. Do not attempt to fix the class-B resolver-miss rows re-routed by the membership review (`clamp(...)`, `maybe_call(on_spawn, ...)`, `self.create_fn(builder, self)`, NestJS DI `.get()` calls, `@UsePipes(...)` decorator applications) — they have real in-repo call expressions and belong to `import_resolution` / `name_resolution` / `receiver_type_inference`, not reachability.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

<!-- AC:END -->

## Implementation Notes

## High-level summary

`detect_indirect_reachability` treats a bound or instance method read as a value the same way it treats a free function: such a callable is reachable without a direct call edge and is removed from the entry-point (dead-code) candidate set. The value-reference arm in `packages/core/src/resolve_references/indirect_reachability.ts` accepts a resolved definition whose `kind` is `function` or `method`. A bare member-name read (`self._acquire_connection`, `this.write`) resolves to its method symbol through lexical scope, so passing a method as an argument, binding it with `.bind(this)`, or storing it into a field all mark the method reachable. Constructors are excluded: reading a constructor as a value is not a real pattern, and constructor invocations arrive as call references rather than reads.

### What changed

- **Value-reference arm widened** (`indirect_reachability.ts`): the gate is `def.kind === "function" || def.kind === "method"`. The definition-site self-reference skip is retained and applies to methods unchanged.
- **Tests**: unit cases in `indirect_reachability.test.ts` cover the method arm, the method definition-site skip, and the constructor exclusion. `Project` + `update_file` integration cases in `classify_entry_points/enrich_call_graph.test.ts` pin the exact entry-point set for every evidence case — Python bound-method-as-argument, Python method-as-value, TypeScript `this.method.bind(this)`, and the Python field-store form — plus regression guards (named function as argument, inline closures across TypeScript/Python/Rust) and a negative guard proving a genuinely dead method whose name is never read stays an entry point.

### Decisions and scope

- **Closure arm (work-plan step 3) needed no code.** Inline anonymous callbacks already receive a synthetic callback call-edge from `call_resolution/call_resolver.ts`, so they are already excluded from entry points across TypeScript, Python, and Rust. The regression guards lock this in.
- **No new reason variant (work-plan step 1).** The Python field-store form decomposes `self.process` into a bare member read the widened arm already catches, so a method-as-value reuses the existing `function_reference` reason. A distinct `field_store_read` variant would be surplus.
- **`constructor` dropped from the step-2 gate.** No evidence case reads a constructor as a value, so including it would be speculative.
- **Builtin deletion (work-plan step 5) deferred to TASK-348.2.** The `higher-order-function-callback`, `inline-callback`, and `stored-callback-via-object-property` builtins are `wip` and unbundled (absent from `permanent_data.ts`), but they are still referenced by `wip` registry rows. Deleting them requires retiring those rows, which is a human-owned registry write under the classifier-lifecycle contract — TASK-348.2's domain.
- **Two TypeScript cases deferred to TASK-190.28.** `this._processor = this.process` (a TS field initializer emits no member read at index time — an indexing-layer gap) and `createPrismaPromise` (the `stored-callback-via-object-property` cross-file `name_not_in_scope` resolver miss) are outside the reachability layer, consistent with work-plan step 8. TASK-190.28 captures both with their evidence fingerprints.

A self-contained HTML companion sits beside this doc (`…core-fix-evidence.html`) recording the evidence-case matrix and the plan-versus-reality analysis.
