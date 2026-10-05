---
id: TASK-392
title: "Stop a type binding registered mid-resolution from being visible only to the files resolved after it"
status: To Do
assignee: []
labels:
  - call-resolution
  - determinism
dependencies:
  - TASK-381.11
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

Which methods a corpus reports as called can depend on the order its files were
handed to the loader. TASK-381.11 removed the two mechanisms that made that true
of vscode; this is the third, and it is order-dependent by construction whether
or not any corpus has yet shown it.

## The mechanism

`TypeRegistry.register_late_binding` (`resolve_references/registries/type.ts:331`)
writes `symbol_types` during Phase 5, called from `call_resolver.ts:309` while
resolving one file's calls. `resolve_calls_for_files` walks the batch file by
file, so a binding registered while resolving file A is visible to file B when B
is resolved after A and invisible when B is resolved first. The batch's walk
order is the ingest order.

The escape hatch is legitimate: a binding like Python's
`user = models.User(name)` genuinely cannot be resolved before call resolution
knows which call landed on which class. What is not legitimate is that its
effect is scoped to the remainder of one pass.

It moved no fingerprint over vscode's `src/` — all seven components are
byte-identical across forward, reverse, descending-byte-size and seeded-shuffle
ingest of all 8,494 files with this in place — because the TypeScript corpus
does not exercise the construct. A Python corpus would.

## What has to hold

Late bindings have to be applied where every file can see them, which means
either a fixed point (resolve, collect the late bindings, re-resolve the files
that could see them, until no new binding appears) or a pre-pass that resolves
constructor calls for the whole batch before any file's calls are resolved. The
choice needs a measurement: a fixed point costs a re-resolution pass and the
corpus figures for one do not exist.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A Python fixture where file B's method call resolves only through a late binding registered while resolving file A gives one call graph in both file orders, driven through the bulk path (`ingest_file` x N then `resolve_corpus`).
- [ ] #2 The seven-number fingerprint over vscode's `src/` is byte-identical before and after the change — this corpus does not exercise the construct, so a move here is a regression and not the fix.
- [ ] #3 A Python corpus is measured across at least two ingest orders, before and after, with its file count and the number of moved entry points stated. Without a corpus that moves, the fix is unverified.
- [ ] #4 The cost is stated from arms interleaved in one session; a fixed point that re-resolves is not adopted on the assumption that it is cheap.

<!-- AC:END -->
