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
