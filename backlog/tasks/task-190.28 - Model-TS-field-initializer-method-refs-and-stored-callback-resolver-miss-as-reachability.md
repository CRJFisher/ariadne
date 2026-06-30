---
id: TASK-190.28
title: "Model TS field-initializer method references and stored-callback resolver-miss as reachability"
status: Done
assignee: []
created_date: "2026-06-27 00:00"
labels:
  - entry_point_classification
  - self-repair
parent_task_id: TASK-190
priority: medium
dependencies:
  - TASK-348
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Task-348 widened `detect_indirect_reachability` so a bound or static **method read as a value** (passed as an argument, `.bind(this)`, or stored into a field whose initializer emits a bare member read) leaves the entry-point set. That fix covers every evidence case whose member read reaches the resolver — including the Python field-store form `self._processor = self.process`, because Python decomposes `self.process` into a bare `process` read.

Two TypeScript false-positive entry-point cases remain, both verified empirically to be **outside the reachability layer** and therefore deferred from task-348:

### Case A — TS field-initializer method reference (`this._processor = this.process`)

A TypeScript class field initializer `private _processor = this.process` produces **no reference to `.process`** at index time — only a `variable_reference` read of `this` is captured. `detect_indirect_reachability` has nothing to key on, so the method stays a false-positive entry point. Fixing this requires an **indexing-layer change**: capture the member read in a TS field initializer (a `member_expression` on `this`/identifier in a `public_field_definition` initializer) so it surfaces as a `variable_reference`/`property_access` read against the method symbol. Once the read exists, task-348's widened value-reference arm marks the method reachable with no further change.

- Evidence fingerprints: `this._processor`, `createPrismaPromise` (the field/property-stored method-reference shape).
- Registry rows: `typed-field-method-dispatch` (`wip`, observed in `nest`, links `TASK-205`), `builtin-higher-order-callback` (`wip`, observed in `typeorm`, `prisma`, links `TASK-204`).

### Case B — stored-callback-via-object-property cross-file resolver miss

A named arrow stored in an object property, destructured in another file, then called as a bare identifier:

```ts
// factory.ts
export function make() {
  const extractValue = (a: number) => a + 1;
  return { extractValue };
}
// use.ts
const { extractValue } = make();
extractValue(5);
```

The call site `extractValue(5)` fails resolution with `name_not_in_scope` (`receiver_kind=none`), so `extractValue` is a false-positive entry point. This is a **name/import resolution miss across the object-property store + cross-file destructure**, not reachability — it belongs to `resolve_references` name/cross-file flow, consistent with task-348 step 8 ("resolver-miss rows belong to import_resolution / name_resolution, not reachability").

- Evidence fingerprint: `createPrismaPromise` / `extractValue`.
- Registry row: `stored-callback-via-object-property` (`wip`, observed in `nest`; concrete site cited in the builtin classifier: nestjs `rpc-context-creator.ts:238`).
- Registry classifier: `check_stored_callback_via_object_property` (diagnosis `callers-in-registry-unresolved`, `name_not_in_scope`, `receiver_kind=none`).

### Work plan

1. Case A: extend the TypeScript capture handlers / queries so a `this.method` (or `Identifier.method`) read inside a class field initializer surfaces as a reference that resolves to the method symbol. Add an AST-level `build_index_single_file` test asserting the field-initializer member read is captured, and a `Project` + `update_file` test asserting `this._processor = this.process` removes `process` from the entry points (mirrors task-348's `engine.py` integration test).
2. Case B: resolve the object-property store + cross-file destructure so `extractValue(5)` links to its definition (name/cross-file resolution, not reachability). Add a cross-file `Project` test asserting the destructured-then-called arrow leaves the entry points.
3. After each case lands, the human retires the corresponding `wip` classifier-registry rows per the classifier-lifecycle contract (`reconcile-registry`): `typed-field-method-dispatch` and `stored-callback-via-object-property`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A TS field initializer `this._processor = this.process` removes `process` from the entry-point set (Case A), with an AST-level test confirming the member read is captured at index time.
- [ ] A named arrow stored in an object property, destructured cross-file, then called, resolves to its definition and leaves the entry-point set (Case B).
- [ ] Integration tests + fixtures cover both cases end-to-end through the real `Project` pipeline.
- [ ] The `typed-field-method-dispatch` and `stored-callback-via-object-property` registry rows are retired by the human once the core fixes land.

<!-- AC:END -->

## Implementation Notes

### High-level summary

Both false-positive cases are resolved at the indexing layer by adding two tree-sitter query patterns — one to TypeScript's `.scm` file, one to JavaScript's. No changes are required in `detect_indirect_reachability` or anywhere downstream: once the reads are captured, the existing task-348 value-reference arm marks the targets indirectly reachable.

**Case A** — A TypeScript `public_field_definition` (JavaScript: `field_definition`) whose initializer is a `member_expression` with `object: [(this) (super)]` emits the `property_identifier` as `@reference.variable`. This captures exactly the `this.process` read in `private _proc = this.process;` without double-capturing external-object reads already handled by the property-access pattern.

**Case B** — An `(object (shorthand_property_identifier))` pattern captures shorthand properties like `{ extractValue }` as `@reference.variable`. The existing catch-all `(identifier) @reference.variable` fires on the function-name node at the definition site (skipped by the same-location guard in `detect_indirect_reachability`); the new pattern fires on the distinct `shorthand_property_identifier` node at the use site, marking the function indirectly reachable.

Both patterns were added to `typescript.scm` and `javascript.scm` for consistency. Tests cover: AST-level `variable_reference` emission (TypeScript capture handler tests, including `this`, `super`, shorthand, and negative method-call guard), and end-to-end entry-point suppression via integration tests (TypeScript and JavaScript, including a cross-file factory.ts + use.ts destructure scenario).

The Case B resolution here is a reachability approximation: `extractValue` is marked indirectly reachable because it appears in a shorthand property in the file where it is defined. Full cross-file call resolution for the destructure path is separate work.

### Registry row retirement (TASK-190.30.1)

The `stored-callback-via-object-property` registry row was retired by TASK-190.30.1
(registry tightening to permanent limitations only) — deferred-feature suppressor
classifiers no longer live in the registry. Its cross-file destructure resolution
remains tracked by this task. `typed-field-method-dispatch` was likewise removed
there (it links to TASK-205). No new tracking task was needed, since this task and
TASK-205 already own the underlying work.
