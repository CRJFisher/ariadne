---
id: TASK-376.4
title: "Make the member index complete: enums, cross-file union, reverse lookup"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - scope_construction
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 4000
plan_dedup_keys:
  - f11c468b3713e6171731cc6ebc6bf5f9223e4dd50c7cf58d52c1112d2ceace57
plan_source_tasks:
  - pt-aeaaf3ea39073708
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 4. Wave 1; no dependencies. TASK-376.8 (the Rust impl attach pass) and TASK-376.14 (structural conformance) are its consumers.

## Root cause

`DefinitionRegistry.update_file` (`resolve_references/registries/definition.ts:181-309`) builds the member index for `class`, `interface` and `enum` definitions (`:229-233`; enums landed with TASK-374, commit `369cd81c`) and writes it with `this.member_index.set(def.symbol_id, flat_members)` at `:279`, once per type definition. A type's members therefore come only from its declaring file: a method declared in another file has no type definition to attach to, which is why a cross-file Rust `impl` contributes nothing (`capture_handlers/methods.rust.ts:47-55`). There is no write path that lets a second file contribute members to a type, no per-file provenance that would let such a contribution be evicted with its own file, and no reverse `name → types` index, which the structural matcher in TASK-376.14 needs.

The registry already carries the pattern to copy: `member_owner` / `owner_members` (`:142-149`) with `register_member_owner` (`:430`) and `forget_owned_members` (`:476`), `type_subtypes` / `subtype_parents` (`:153-162`) with `register_subtype` (`:444-458`) and `forget_type_edges` (`:491`), and `verify_reverse_indices` (`:748`) / `assert_reverse_indices_consistent` (`:793`), all from TASK-381.3.

## Work plan

1. Add a provenanced write path: `attach_members(type_id, file, members)` merges `name → SymbolId` pairs into the type's member map and records them under `members_by_file: Map<FilePath, Map<SymbolId, Set<SymbolName>>>`; make `update_file`'s own write at `:279` go through the same path so a type's members are the union across every contributing file; make `remove_file` (`:521`) evict only the evicted file's contributions, the way `forget_owned_members` does for `owner_members`. Extend `verify_reverse_indices` to rebuild `members_by_file` from scratch and compare, because a missed write site under-evicts silently.
2. Maintain `members_by_name: Map<SymbolName, Set<SymbolId>>` beside `member_index` at every write site and tear it down at every eviction site.
3. Add `get_members_by_name(name)` and `get_member_closure(type_id)`: own members plus the members inherited through `subtype_parents`, following only parents of the **same kind** — a class walks its parent classes, an interface its parent interfaces — because `ClassDefinition.extends` (`packages/types/src/symbol_definitions.ts:91`) conflates `extends` and `implements`, and counting an implemented interface's signatures as a class's own members over-approximates. Terminate on cycles the way `walk_inheritance_chain` does (`registries/type.ts:354-357`).
4. Keep `set_member_symbol` (`type_preprocessing/member.ts:28-42`, getter-over-any-other-accessor since TASK-374) as the forward-lookup policy; `attach_members` applies the same rule.
5. Add registry unit tests through `attach_members` directly (no producer exists in the pipeline until TASK-376.7 removes the emission gate): a type whose members arrive from two files exposes the union; evicting one file removes exactly that file's members; `update_file` twice on the same file neither duplicates nor loses members; `get_member_closure` returns own members plus the parent-class chain, excludes an implemented interface's signatures, and survives `remove_file`; `members_by_name` is torn down per file; `verify_reverse_indices` reports a deliberately corrupted `members_by_file`.
6. Add the same-file Rust integration case at the `Project` + `update_file` tier: a struct with a field and a method sharing a name plus a second `impl` block in the same file, asserting the member index holds the method under the name and the field elsewhere. The cross-file Rust evidence (rustc `LoweringContext`) lands with TASK-376.8, which is the first producer of a cross-file contribution.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `attach_members` exists, `update_file`'s own member write goes through it, and a type's member index is the union across every contributing file with per-file provenance in `members_by_file`.
  Evidence: `DefinitionRegistry.attach_members(type_id, entries)` is the single writer of `member_index`, `members_by_file` and `members_by_name`; `update_file` feeds a type's methods, properties, constructors and class-body aliases through it in that order. It credits each name to the file its member is declared in rather than to a caller-supplied file, so work-plan item 1's `file` parameter is gone. `definition.test.ts` › "member index across files" › "exposes the union of members attached from two files under one type", "keeps another file's contribution when the declaring file is re-indexed" and "refuses a member the registry does not hold, because its file is the provenance".
- [x] #2 `remove_file` removes only the evicted file's contributions (verified by the two-file and the `update_file`-twice unit tests), and `verify_reverse_indices` covers the new index.
  Evidence: "evicts exactly the evicted file's members and leaves the declaring file's", "neither duplicates nor loses members when a file is updated twice" (the second index drops a method the file no longer declares), "takes a contribution back from a file that declares nothing of its own", "re-indexing the contributing file takes its contribution with it until it is attached again", "keeps a contribution to a type whose own declaration is evicted", "leaves no member index entry for a type that declares no members" and "tears members_by_name down per file". `verify_reverse_indices` rebuilds `members_by_file` from the file each held member is defined in and `members_by_name` from `member_index`; both directions and both indices are pinned by "reports a members_by_file entry a write site failed to populate", "reports a members_by_file name an eviction path left behind", "reports a members_by_name entry a write site failed to populate" and "reports a member the index holds that no definition can own". The whole suite runs with the assertion armed (`tests/setup.ts`), and the eviction-cost test asserts all three member maps empty after a 1,200-file load is evicted.
- [x] #3 `members_by_name`, `get_members_by_name` and `get_member_closure` exist; the closure walks only same-kind parents and terminates on cycles.
  Evidence: `definition.test.ts` › "get_member_closure" › "returns own members plus the parent-class chain, with the nearest declaration winning", "excludes an implemented interface's signatures and includes a parent interface's for an interface", "keeps a parent class's members and drops an implemented interface's for a class with both", "terminates on a cycle in a malformed hierarchy", "survives the eviction of a parent's file".
- [x] #4 The same-file Rust field/method name-collision case passes at the `Project` tier.
  Evidence: `resolve_references.rust.test.ts` › "same-file field and method sharing a name" › "holds the method under the name in the member index and the field as an owned member, so the call resolves to the method": `struct Job { run: bool }` with `fn run(&self)` in one `impl` and `fn stop` in a second; the member index holds each name against the declaring method's own `symbol_id`, the field stays owned by `Job`, and `job.run()` resolves to the method. On the base tree the field overwrote the method and `job.run()` resolved to the property. Its sibling, "walks a property chain through the field, so a call on the field's type still resolves", pins the other half of the rule: `self.data.ping()` on a `struct Buf { data: Inner }` beside `fn data(&self)` resolves `ping` on `Inner`.
- [x] #5 `definition.test.ts` stays green (behavioural assertions intact under the new shapes).
  Evidence: no pre-existing assertion changed; the full core suite passes (194 files, 4,454 tests) with `tsc --noEmit` and `pnpm lint` clean. The registry tests pin new API and so cannot run on the base registry at all; the two Rust `Project`-tier cases are the behavioural regression tests, and each was run against a base checkout of `definition.ts` to confirm it discriminates.

<!-- AC:END -->

## Implementation Notes

### High-level summary

A Rust call to a method whose name a field of the same struct also carries now reaches the method: `job.run()` resolves to `fn run`, so the method stops being reported as an unreachable entry point and the field stays reachable as a member the type owns. A hop through such a name still reaches the field, because a chain position needs the value's type: `self.data.ping()` on a `struct Buf { data: Inner }` beside `fn data(&self)` resolves `ping` on `Inner`.

Behind that, a type's member set can now be assembled from more than one file and taken apart file by file, so a method declared in a second file — a cross-file Rust `impl`, attached by TASK-376.8 — becomes a member of its type without rebuilding the registry, and an interface's member names can be looked up in reverse for TASK-376.14's structural matcher. `attach_members` is the single writer of the member index, with per-file provenance that eviction reads back exactly; `members_by_name` is the reverse index; `get_member_closure` walks only same-kind parents so an implemented interface's signatures never count as a class's own members. Start at `attach_members` in `registries/definition.ts` and the "member index across files" describe in its test.

### The rule that decides a name

One rule, `member_takes_slot`, decides every name a type's members contend for: a property never displaces a callable, a setter or deleter never displaces anything, and a callable displaces whatever else holds the name. It mirrors `set_member_symbol` for accessor pairs and adds the callable-over-property clause, which is what the Rust field/method collision needed: a pre-merged map let a field silently overwrite the method of its name. `update_file` therefore hands `attach_members` an ordered list of entries rather than a map, so two members contending for one name both reach the rule, and class-body aliases are computed on a copy and attached as the rebindings they produce, so the registry keeps one writer.

The rule governs the flat callable-member index only. `set_member_symbol` stays the accessor policy for the separate method and property maps `TypeRegistry.get_type_members` builds — a deviation from work-plan item 4, which expected one rule to serve both. The two surfaces answer different questions: the member index answers "what callable does this name reach", and the chain walk in `receiver_resolution.ts` asks "what value does this name reach", which is why a hop consults the type's declared properties before accepting a callable the index handed back.

### Provenance

Provenance is a set of names per file and type, and `attach_members` credits each name to the file its member is declared in rather than taking the file from its caller. That is the same fact the invariant checker rebuilds from, so live and rebuilt provenance agree by construction and a producer cannot mis-file a contribution; a member the registry does not yet hold is refused, because there is no file to credit. A name two files contend for belongs to the file whose member holds it; when another file's member takes the name, the losing file's provenance releases it.

The lossy corner is two files holding one member name for a type — a field here, a method of its name in another file's `impl` — and evicting the file whose member won: the name goes absent rather than reverting to the loser, though the loser stays reachable through `member_owner`, and re-indexing the surviving file restores it.

A type keeps what another file contributed after its own declaration is evicted, so re-indexing the declaring file restores the union rather than losing it. Three consequences follow for TASK-376.8. Its attach pass re-runs whenever the contributing file is indexed, because a file's contributions leave with the file. A symbol id carries its declaration's location, so a contribution keyed on a type whose declaration later moves lines waits on the old id until the contributing file is indexed again; the pass owns that re-attach. And a class-body alias is credited to the file of the member it rebinds to, which once a contribution crosses files need not be the file whose class body declares the alias — so the pass recomputes a type's aliases whenever it contributes to that type.

`TypeRegistry` snapshots a type's member map when the type's own file is indexed, so a cross-file contribution does not reach that snapshot on its own; the attach pass re-resolves type metadata for the types it contributes to.

### Follow-up

`get_members_by_name` and `get_member_closure` have no pipeline caller yet; TASK-376.14 and TASK-376.8 are theirs. The dead-code Stop hook may report them as entry points until then.

The enum member index itself was delivered by TASK-374 and stands on `definition.test.ts` › "indexes an enum's associated functions as its members"; the sqlx `PgCube` row and the cross-file Rust evidence this step's title implies move to TASK-376.8, the first pass that contributes a member across files.
