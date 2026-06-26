---
id: TASK-347
title: "Complete the member surface a resolved receiver exposes"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - method_lookup
dependencies: []
priority: high
plan_dedup_key: 0625f655075bb953250e838c93ba3fe72df1675d663a578963fcd8e4463fe687
plan_source_task: pt-577457222a209bca
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. Thread the export-chain inputs into the call-resolution context. Add `exports: ExportRegistry`, `languages: ReadonlyMap<FilePath, Language>`, and `root_folder: FileSystemFolder` to `ReceiverResolutionContext` (`packages/core/src/resolve_references/call_resolution/receiver_resolution.ts:59-65`) and `CallResolutionContext` (`call_resolver.ts:57-64`). Populate them in `ResolutionRegistry.resolve_calls_for_files` (`resolve_references.ts:139-159`) and its caller in `project.ts:420,496`, passing the `Project`'s own `this.exports` and the same languages/root-folder instances it gives name resolution (not stale copies).

2. Mechanism B — route namespace-export lookup through the existing chain-follower. Rewrite `resolve_namespace_export` (`method_lookup.ts:324-338`) to delegate to `ExportRegistry.resolve_export_chain(source_file, export_name, "namespace", languages, root_folder)` and return its result; delete its naive local-scan `for` loop (`method_lookup.ts:331-335`). Keep the call shape of its callers — the namespace branch (`method_lookup.ts:48-69`), the submodule-fallback branch (`method_lookup.ts:88-104`), and `constructor.ts:63` (namespace-qualified `new ns.Foo()`) — now reading the threaded context data. Add a TypeScript barrel re-export regression test: `mod.ts` does `export { foo } from './impl'`; caller does `import * as ns from './mod'; ns.foo()` resolves to `impl.ts`'s `foo` (covers all 10 TS namespace rows).

3. Mechanism A — key the constructor into the flat member index. In the constructor loop of `DefinitionRegistry.update_file` (`registries/definition.ts:159-166`), add `flat_members.set(ctor.name, ctor.symbol_id)` (key is `__init__` for Python, `constructor` for TS/JS, the impl-method name for Rust — exactly the `method_name` the receiver layer carries for a class-target call). Add a Python constructor-linkage regression test: `class C: def __init__(self): ...` in one file, `C()` / `module.C(...)` in another resolves with `resolution_count > 0` and no `method_not_on_type` (covers all 14 django constructor rows). Before keying, verify Rust/JS constructor naming cannot collide with an ordinary method name.

4. Delete the now-dead `constructor` field from `TypeMemberInfo` extraction (`type_preprocessing/member.ts:73-74,82`) — it is the drifting twin of the flat index and is reachable through the member map once mechanism A lands. Fix any compile references.

5. Operator-alias capture — extend the `definition.ts` member-index build to capture simple class-body `name = other_member` assignments (literal name-to-member-name at class-body scope, including the `if not TYPE_CHECKING:` conditional form) as an extra alias entry alongside mechanism A. Add a sqlalchemy `__getitem__ = _getitem` regression test asserting both keys resolve (covers the 2 path_registry rows).

6. Keep the insulated suites green: existing namespace/object-literal cases in `method_lookup.test.ts`, the inheritance/polymorphism tests (`resolve_polymorphic_class_method` reads the same index — the constructor key must not perturb dispatch), and `export.ts` re-export tests. Confirm no test asserted the old constructor-miss behavior for `obj.__init__()` / `super().__init__()`, and that polymorphic dispatch over the constructor key does not fan a constructor call out to every subclass's `__init__`. Run the full `resolve_references` and `index_single_file` suites. Add the §8 multi-file fixtures (barrel re-export; Python constructor-instantiation).

7. Do NOT author the interim classifier (`pt-65d46e6a03614db3`): per `.claude/rules/classifier-lifecycle.md` the classifier spec is human-authored and neither pipeline skill writes the registry, and with mechanisms A and B landing the durable fix the interim mitigation is retired — excluded from this epic.

8. Excluded rows route elsewhere (not part of this change): `annotation.py:480` `clone` (scope-shadowing → name_resolution fault area), `provision.py:158` `on_conflict_do_update` and `pandas test_parquet.py:380` `to_parquet` (return-type / receiver-type inference fault area).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

<!-- AC:END -->
