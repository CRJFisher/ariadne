---
id: TASK-381.10
title: "Look self-keywords up in a Map so x.toString() stops being recorded as a call on self"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - bug
  - receiver_type_inference
  - persistence
dependencies:
  - TASK-381.1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`extract_receiver_info` declares its self-keyword table as a function-local object literal — `const SELF_KEYWORDS: Record<string, "this" | "super"> = { this: "this", super: "super" }` — and then indexes it with `SELF_KEYWORDS[chain[0]]` (`packages/core/src/index_single_file/query_code_tree/metadata_extractors/metadata_extractors.javascript.ts:369-373`). For a receiver chain rooted at a plain identifier named `toString`, `valueOf`, `constructor` or `hasOwnProperty`, that lookup returns `Object.prototype`'s member — a native function — and `is_self_reference: keyword !== undefined` evaluates true. TypeScript reuses the JavaScript extractor verbatim (`metadata_extractors.typescript.ts:79`), so the entire TypeScript corpus is on this path.

`new URL('/token', authorizationServer).toString()` in `oauth.ts:923`, `hash.ts:132`'s `.toString().padStart(2)` and three more sites in `vs/base` alone are recorded today as `self_reference_call` carrying a function in the `keyword` field. On `vs/base` those corrupted records happen to resolve to nothing, so it reads as a latent hazard there — but in any class that declares its own `toString` or `valueOf` those calls resolve to the wrong target, and `.toString()` is one of the most common idioms in the language.

It also corrupts the persistence cache today. `JSON.stringify` silently drops a function-valued property, so a cache-restored file carries a different reference record than a freshly indexed one and nothing reports the divergence. `structuredClone` refuses outright, which is how the bug surfaced: five files failed to cross a worker boundary with `function toString() { [native code] } could not be cloned`, and the pre-fix worker transport lost 133 nodes, 172 call edges and 15 entry points on `vs/base` alone. That makes this a prerequisite for TASK-381.17 as well as a correctness fix on its own terms.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `SELF_KEYWORDS` is a module-scoped `Map` read with `.get()`, and no object-literal index remains in `extract_receiver_info`.
- [ ] #2 #2 A regression test asserts `toString.padStart(2)` yields `is_self_reference: false`, covering `toString`, `valueOf`, `constructor` and `hasOwnProperty`.
- [ ] #3 #3 No `SemanticIndex` field holds a function value: `structuredClone` of the `SemanticIndex` returned by `build_index_single_file` succeeds for every discovered file, against 5 that throw `function toString() { [native code] } could not be cloned` today. The 5 repo-relative paths are listed in the task so the fix is checkable against them individually.
- [ ] #4 #4 A cold index and a cache-restored index of the same file produce identical reference records, asserted over the `vs/base` 200-file slice.
- [ ] #5 #5 `metadata_extractors.javascript.test.ts` stays green.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## What the user gets

A call written `x.toString()` is reported as a call on `x`. Before this, a
receiver chain rooted at a plain identifier that happens to name an
`Object.prototype` member — `toString`, `toLocaleString`, `hasOwnProperty` and
their siblings — was recorded as a call on the enclosing class, so in any class
declaring its own `toString` or `valueOf` those call edges pointed at the wrong
target. `SELF_KEYWORDS` is a module-scoped `Map` holding `this` and `super`
alone, and a name it does not hold is a name, not a keyword.

The same defect made a file's reported references depend on how the file
arrived. The keyword field held a native function, which JSON drops without a
word and the structured-clone algorithm refuses outright, so a cache-restored
file carried different references from a freshly indexed one and a
worker-indexed file carried none at all. Both transports now carry every
reference record unchanged.

## The two transports, measured

microsoft/vscode@f3fa55c3 · Darwin 24.6.0 x86_64 · 6 cores · 32 GiB ·
node v22.22.1. Pre-fix arm at ariadne@a078e519, post-fix arm at ariadne@bf0d6a3a,
both in one session against the same corpus checkout.

At corpus scale — predicate `src`, 8,494 of 8,494 discovered files, every file
indexed through `build_index_single_file` and offered to `structuredClone`:

| arm | files cloned | files refused |
| --- | --- | --- |
| pre-fix | 8,281 | 213 |
| post-fix | 8,494 | 0 |

The 213 refusals held 615 function-valued `SymbolReference.keyword` fields
between them, naming three distinct natives — `toString`, `toLocaleString` and
`hasOwnProperty`. `toLocaleString` is the reason the fix is a `Map` of the two
real keywords rather than a longer list of names to exclude: no enumeration of
`Object.prototype` written by hand stays complete.

## The six vs/base paths, and why five is the transport number

Over the slice this epic states its slice-scale figures on — predicate
`folder-ts:src/vs/base`, the first 200 of 479 path-sorted files — six files hold
a function-valued field pre-fix and none do post-fix. Both transports fail on
exactly the same six, so the list checks the fix file by file:

- `src/vs/base/browser/iframe.ts`
- `src/vs/base/browser/markdownRenderer.ts`
- `src/vs/base/common/event.ts`
- `src/vs/base/common/hash.ts`
- `src/vs/base/common/htmlContent.ts`
- `src/vs/base/common/oauth.ts`

Six, not the five this task was written with, and the two numbers are both
right about different things. `src/vs/base/common/event.ts` is one of the 15
files the load drops from that slice on this tree, so it is never offered to a
worker: six files build an unclonable index, five of them reach a transport.
AC #3's count is the six that `build_index_single_file` produces, since that is
what the criterion measures.

## The reported graph does not move

The epic requires every step outside 3, 9 and 10 to leave the seven-number
fingerprint byte-identical, and this one does at both scales it was taken at.
`folder-ts:src/vs/base` at 200 files (185 indexed, 15 dropped) and `src` at
1,200 files (1,145 indexed, 55 dropped) reproduce every component exactly across
the two trees:

| scale | nodes | call edges | unresolved | raw entry points | indirect keys | dropped | indirect evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| vs/base 200 | 4489/ed52bfdc4390ce91 | 4612/78fe76a12e7b741f | 8107/af65333659086bff | 1518/47cd168e752835d0 | 821/8ffe9ec8ebd60173 | 15/e9240d8d08cdeafd | 821/f2be5826108a3188 |
| src 1,200 | 25912/a9b1c99b033e33f2 | 37163/02d3498eb784cf3c | 70119/e9ceb37a4c168ca7 | 4133/dc9863e24d7d7247 | 3826/127d0ed1b814afc0 | 55/7f902eb30c055b2e | 3826/8df82c66256b242e |

The corrupted records resolved to nothing in both file sets, so removing them
changes no edge there. That silence is a property of these two file sets and not
of the fix: a class declaring its own `toString` would have resolved those calls
to the wrong target, and 213 files across the corpus carry the defect.

## Where the guards live

`serialize_index.corpus.test.ts` runs the slice through both transports and
skips cleanly where the corpus is absent; `serialize_index.test.ts` carries the
same two assertions over snippets rooted at `toString`, `valueOf`, `constructor`
and `hasOwnProperty`, so the mechanism is guarded on every test run. Both were
run against the pre-fix tree before being trusted on this one: ten rows fail
there and name the same six files.

<!-- SECTION:NOTES:END -->
