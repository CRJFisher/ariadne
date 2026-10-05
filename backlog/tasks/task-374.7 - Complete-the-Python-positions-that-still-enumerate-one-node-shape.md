---
id: TASK-374.7
title: "Complete the Python positions that still enumerate one node shape"
status: To Do
assignee: []
created_date: "2026-08-11 21:40"
labels:
  - syntactic_extraction
dependencies: []
parent_task_id: TASK-374
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

TASK-374 made the class-definition and decorated-method positions complete over
the node shapes their grammatical position admits. Three Python positions still
enumerate one shape, and each erases a whole symbol or a whole edge.

1. **A definition nested in a compound statement is erased.** The method and
   function patterns in
   `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
   require the definition to be a direct child of a class body or module block.
   A method or function guarded by `if` / `else` / `try` / `except` matches
   nothing:

   ```python
   class C:
       if sys.version_info >= (3, 11):
           def modern(self): ...
       else:
           def legacy(self): ...
   ```

   Running the shipped query over that source yields `definition.class` for `C`
   and `definition.parameter` for each `self` — and **no** `definition.method`
   for either method. A module-level `if X: def f(): ...` yields no
   `definition.function` either. The parameters of a method that does not exist
   are captured, so the index holds an incoherent partial record. This shape is
   common in compatibility shims and stdlib-adjacent code.

   The field patterns already special-case the `if_statement` position in the
   same file, so the omission is inconsistent within one query.

2. **A call whose callee is not an identifier or an attribute contributes no
   edge.** `@reference.call` is emitted only for `function: (identifier)` and
   `function: (attribute)`. A dispatch-table call (`handlers[key](x)`), a
   curried call (`factory()(x)`) and a parenthesized callee
   (`(lambda z: z)(3)`) match neither, so their targets stay unreachable
   entry points.

3. **An attribute read through a chain mints nothing.** The Python member read
   is pinned to `object: (identifier)`, while the JavaScript and TypeScript
   member reads accept `object: (_)`. `self.row.data` records only its
   innermost link, so a `@property` read through any chained receiver never
   becomes an edge to the getter and the getter is still reported unreachable —
   the same false positive TASK-374 cleared for the single-link shape.

## Work plan

1. Make the class-body and module-block definition positions accept a
   definition nested in a compound statement. The builder already resolves
   ownership by walking to the nearest `class_definition`
   (`find_owning_class_node`), so the query need not enumerate the wrapper
   shapes — capture the definition and let the builder attribute it.
2. Widen `@reference.call` over the callee shapes the grammar admits, keeping
   exactly one `@reference.call` per call node.
3. Widen the Python member read to `object: (_)` and confirm the groundedness
   guard in `references/references.ts` (which already peels wrappers and
   descends `attribute` / `subscript`) admits the shapes it should.
4. Add the shapes to `packages/core/tests/fixtures/python/code/` so the
   definition-coverage audit in `query_code_tree.test.ts` locks them.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A method declared inside an `if` / `else` / `try` / `except` block in a class body yields one `@definition.method`, and a module-level function inside `if` yields one `@definition.function`.
- [ ] #2 No node yields definition captures for its parts (parameters) without a definition capture for the definition itself.
- [ ] #3 `handlers[key](x)`, `factory()(x)` and `(lambda z: z)(3)` each yield exactly one `@reference.call`.
- [ ] #4 A `@property` read through a chained receiver (`self.row.data`) creates an edge to the getter, asserted at `Project` + `update_file` level with a negative control.
- [ ] #5 The Python fixture corpus carries each shape and the definition-coverage audit passes over it.

<!-- AC:END -->
