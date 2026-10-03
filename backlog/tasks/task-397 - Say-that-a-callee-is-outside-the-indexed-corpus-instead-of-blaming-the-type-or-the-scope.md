---
id: TASK-397
title: >-
  Say that a callee is outside the indexed corpus instead of blaming the type or
  the scope
status: To Do
assignee: []
labels:
  - name_resolution
  - import_resolution
  - measurement
dependencies:
  - TASK-376.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A call to `len(x)`, `expect(y).toBe(z)`, `np.arange(3)` or `os.path.dirname(p)` cannot be resolved by this pipeline, ever: the callee is defined in the Python builtins, in Jasmine, in numpy, in the standard library — never in the files the corpus indexed. Today every one of those is reported as a resolver failure, under a reason that names a resolver defect.

Two things break because of it.

**A user cannot tell a defect from the corpus boundary.** `name_not_in_scope` means "this pipeline could not find where the name is bound". For `len` it is not true — the name is bound by the language, and nothing the resolver does will ever bind it. A reader triaging a corpus cannot separate the rows worth fixing from the rows that are the file set's edge.

**Every recovery figure is stated over a denominator that is mostly unaddressable.** TASK-376.18 measured the residue on the nine evidence corpora and found the dominant share is a callee the corpus does not contain: angular's largest reason is **65.7%** Jasmine (`expect`, `it`, `toBe`, `toEqual`), pandas's is **60%** pytest and numpy, django's is **38%** `unittest` with another **28%** Python builtins, and rustc, tokio and sqlx are each **~27%** Rust prelude (`Ok`, `Some`, `Err`, `unwrap`). So "reduce unresolved calls on angular" is met more cheaply by excluding one vendored bundle than by any resolver work, and a real `name_not_in_scope` regression is invisible inside the framework noise it shares a bucket with.

`derive_fault_area` compounds it: every one of those rows routes to `name_resolution` or `receiver_type_inference`, so the fix-planning engine is handed a fault area of 148,000 rows that no fix will shrink.

## Root cause

`ResolutionFailureReason` (`packages/types/src/resolution_failure.ts:34-48`) already carries `import_unresolved` and `reexport_chain_unresolved`, and `method_lookup.ts` emits them at `:70`, `:163` and `:172`. **Both read zero on all nine evidence corpora, on both arms of TASK-376.18's run.** They are unreachable for the shape that matters, and three distinct observations collapse into two wrong ones.

Measured on a four-file probe (Python and TypeScript, one importable local module as a control, which resolves in both):

| What the resolver actually observed | Reason it records | Reason that is true |
| --- | --- | --- |
| The receiver is bound by an import whose module resolved to no indexed file (`os.getcwd()`, `np.arange(3)`, `fs.readFileSync(p)`) | `method_not_on_type` | `import_unresolved` |
| The name is bound by an import whose module resolved to no indexed file (`render` from a package that is not there) | `name_not_in_scope` | `import_unresolved` |
| The name is a language global or builtin (`len`, `print`, `console`, `JSON`, `Ok`, `Some`) | `name_not_in_scope` | a reason that does not exist yet |

Two findings behind that table, each reproduced in Python and in TypeScript:

1. **A namespace import is indexed as a `variable`, not an `import` — in both languages.** `resolve_method_on_type` (`call_resolution/method_lookup.ts:65`) gates its whole import-shaped branch on `receiver_def?.kind === "import" && receiver_def.import_kind === "namespace"`, and the named/default branch beside it (`:116`) gates the same way. `import os` produces `variable:<file>:1:8:1:9:os` and `import * as fs from "fs"` produces `variable:<file>:1:13:1:14:fs`, so neither branch can fire for a module receiver and `import_unresolved` is unreachable for this shape in every language. That is why it reads zero on all nine corpora rather than on the Python ones alone.
2. **The failure already knows the module is missing and reports the type instead.** `os.getcwd()`'s `partial_info` carries `import_target_file: "<corpus>/os.py"` — a path the resolver computed for a file the corpus does not hold and never checked — and `fs.readFileSync(p)`'s carries `import_target_file: "fs"`, the bare specifier, unresolved. In both cases the resolver had the fact in hand and still recorded "the type has no such member".

`method_not_on_type` is the worst of the three to land in: it asserts the receiver **has** a type and that the type **lacks** the member. On `os.path.dirname` neither half is true.

## Design constraint this must respect

`ResolutionFailureReason`'s own contract (`resolution_failure.ts:23-33`) is that each value "names a single observation the resolver made about its own internal state — never a classifier verdict or failure category". A reason meaning "this is third-party code" would break that. Both reasons below are observations:

- **`import_unresolved`** — already the contract's shape: the resolver followed a binding to an import and the import's module named no file the corpus holds. No judgement about why.
- **`callee_is_a_language_global`** — the new one. The observation is "the scope chain binds this name nowhere, and the name is in the set this language binds without a declaration". The set is a language fact of the same kind as `SELF_REFERENCE_KEYWORDS`, not a taxonomy.

A name that is neither — an ordinary identifier with no binding and no import — keeps `name_not_in_scope`, and that residue becomes a number worth acting on for the first time.

## Work plan

1. **Make the import branch reachable.** Establish what `import os`, `import numpy as np`, `import * as fs from "fs"`, `use std::fs` and `const x = require("pkg")` each index as, per language. Either record a module import as an `import` definition with `import_kind: "namespace"` in every language, or widen `resolve_method_on_type`'s two gates (`method_lookup.ts:65` and `:116`) to whatever kind the indexer does record. Prefer the first: one shape for one concept is why this branch went dead.
2. **Stop naming a file the corpus does not hold.** Wherever `import_target_file` is populated, carry the path only when the file is in the indexed set; otherwise record the unresolved module specifier as the partial info. A `partial_info` naming a non-existent file has sent at least one reader to `method_not_on_type` looking for a member index that was never the problem.
3. **Route the name-resolution half.** When a name's only binding is an import whose module resolved to no indexed file, fail `import_unresolved` at stage `name_resolution` rather than `name_not_in_scope`.
4. **Add `callee_is_a_language_global`** to `ResolutionFailureReason`, to `RESOLUTION_FAILURE_REASONS` (`benchmark_corpus_load/failure_taxonomy.ts:31-45`) and to `REASON_TO_AREA` (`packages/types/src/ariadne_fault_area.ts:143-158`). Carry the per-language global set beside the language's other facts, not in the resolver: Python builtins, the JavaScript and TypeScript host globals (`console`, `JSON`, `Math`, `require`, `process`), and the Rust prelude (`Ok`, `Err`, `Some`, `None`, `Vec`, `Box`, `String`, `drop`).
5. **Give the two reasons a fault area that owns nothing.** `REASON_TO_AREA` maps every reason to a module that could fix it. Neither of these has one, and mapping them to `import_resolution` and `name_resolution` is what floods those areas today. Add an area whose `ARIADNE_FAULT_AREA_FOLDER` entry is the empty string, the way `other` already is, so the plan engine stops routing unfixable rows into fixable buckets.
6. **Re-measure against TASK-376.18's row.** Re-run the nine corpora with `run_load_benchmark.ts --baseline` and `scripts/sample_failure_sites.ts`. The resolved-call count, the call-edge fingerprint and the raw-entry-point fingerprint **must not move at all** — this step re-labels failures and resolves nothing — and the two new columns must account for the shares TASK-376.18 measured. Record the row beside `RECORDED_CORPUS_RESOLUTION`.

## Why this is worth more than the remaining TASK-376 sub-tasks

It resolves no additional call. What it changes is what every future measurement means: after it, "unresolved calls" is a number about this pipeline rather than about which files the predicate happened to include, and the `name_resolution` fault area is a list a person can work through. TASK-376.18's residue analysis could only be produced by hand, with a script written for that one session; this makes the same attribution a property of the output.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 A call whose receiver is bound by an import that resolved to no indexed file fails `import_unresolved`, in every one of the four languages, and no longer fails `method_not_on_type`.
  Evidence: `unindexed_import_receiver_failure` (`call_resolution/outside_corpus.ts`) and `resolve_method_on_type` (`method_lookup.ts`) fail `import_unresolved`, stage `import_resolution`, when the receiver's import names no indexed file. Project-tier tests, one per language: `os.getcwd()`, `os.path.dirname(p)`, `np.arange(3)` (Python, `resolve_references.python.test.ts` "Callees outside the indexed corpus"), `fs.readFileSync(p)` (TypeScript and JavaScript), `std::fs::read` (Rust). On the nine corpora the control arm held `import_unresolved` at 0 everywhere and the candidate holds it at 619 (express) to 45,513 (pandas); pandas `method_not_on_type` falls 38,835 -> 3,557.
- [x] #2 A call whose name is bound by an import that resolved to no indexed file fails `import_unresolved` and no longer fails `name_not_in_scope`.
  Evidence: `unbound_name_failure` (`outside_corpus.ts`) resolves a name's binding through the scope chain, including Python's hoisted `try`/`if` imports, and fails `import_unresolved` at stage `name_resolution` / `constructor_lookup` when its module names no indexed file. Tests: `render` from `some-missing-pkg` (TypeScript, JavaScript), `from missing import render` and `OrderedDict()` (Python), `render` from `missing_crate` (Rust), and a guarded `from yaml import safe_load` (Python).
- [x] #3 `partial_info.import_target_file` names only a file the corpus indexed; an unresolved module is carried as its specifier instead.
  Evidence: `indexed_import_file` (`outside_corpus.ts`) returns a path only when `languages` holds it; the three `import_target_file` sites in `method_lookup.ts` read it, and an unresolved module is carried as `partial_info.import_specifier` (`resolution_failure.ts`). Tests pin `import_target_file: null, import_specifier: "os" | "numpy" | "fs" | "std"` for unindexed modules and `import_target_file` equal to the indexed `local.ts` for a member an indexed module lacks; a module that arrives after its caller reports `./later` as a specifier, then resolves.
- [x] #4 `callee_is_a_language_global` exists in `ResolutionFailureReason`, `RESOLUTION_FAILURE_REASONS` and `REASON_TO_AREA`, and `len`, `print`, `console`, `JSON`, `Ok`, `Some` and `require` fail under it rather than under `name_not_in_scope`.
  Evidence: `callee_is_a_language_global` is in `ResolutionFailureReason`, `RESOLUTION_FAILURE_REASONS` and `REASON_TO_AREA`; the per-language sets live in `packages/types/src/language_globals.ts` (`is_language_global`, tested in `language_globals.test.ts`). Project-tier tests assert `len` and `print` (Python), `console`, `JSON` and `require` (JavaScript, TypeScript), `Some`, `drop` and `Vec` (Rust; `Ok` is in the Rust set and pinned in `language_globals.test.ts`) fail under it. A local definition or an import of the same name wins over the global.
- [x] #5 Both reasons route to a fault area with no owning module, so the plan engine stops routing them to `name_resolution` and `import_resolution`.
  Evidence: `ARIADNE_FAULT_AREA_FOLDER.outside_indexed_corpus` is the empty string, and `REASON_TO_AREA` maps `import_unresolved` and `callee_is_a_language_global` to it; `ariadne_fault_area.test.ts` pins both routes and that no reason with an owner reaches it. `import_resolution` keeps only `reexport_chain_unresolved`.
- [x] #6 Integration tests at the `Project` tier cover, per language, an out-of-corpus namespace import, an out-of-corpus named import, a language global, and an in-corpus control that still resolves.
  Evidence: per language, `resolve_references.{python,javascript,typescript,rust}.test.ts` each carry a "Callees outside the indexed corpus" suite at the `Project` tier: an out-of-corpus namespace import, an out-of-corpus named import, a language global, and an in-corpus control (`helper`, `local`) that still resolves. `npx vitest run` in `packages/core`: 236 files, 5,406 tests pass; `packages/types` and `.claude/skills/plan` suites pass.
- [x] #7 The ten corpora of `RECORDED_CORPUS_RESOLUTION` are re-run: resolved calls, the call-edge fingerprint and the raw-entry-point fingerprint are **unchanged**, and the two reasons account for the shares TASK-376.18 measured for pandas (~60% of `method_not_on_type`), django's builtins and stdlib (~28%), and the Rust prelude on rustc, tokio and sqlx (~27%). Angular's Jasmine share (~65.7%) and django's `unittest` share (~38%) are outside this task's design and stay in `name_not_in_scope` and `method_not_on_type`.
  Evidence: see Measurement below; the fingerprints and the shares named here hold, and the two excluded shares are explained there.

<!-- AC:END -->

## Measurement

`run_load_benchmark.ts --baseline` over the ten corpora of `RECORDED_CORPUS_RESOLUTION` (nine plus mocha), same commits and predicates, control arm a worktree at `0dceea99` and candidate arm this tree, one box. The control is the tree the step started from rather than `038b7daa`, because TASK-376.19-24 moved `RECORDED_CORPUS_RESOLUTION`'s resolved counts (celery 11,254 -> 11,357); an unchanged check against that row would measure those steps. The row is `RECORDED_OUTSIDE_CORPUS_ATTRIBUTION` in `recorded_outside_corpus_attribution.ts`, pinned by its test.

**Unchanged on all ten corpora:** call references, resolved calls, the call-edge fingerprint and the raw-entry-point fingerprint (count and hash), and every reason outside the four this step relabels.

| Corpus | `name_not_in_scope` | `method_not_on_type` | `callee_is_a_language_global` | `import_unresolved` |
| --- | --- | --- | --- | --- |
| angular | 148,000 -> 119,640 | 5,580 -> 1,260 | 13,477 | 19,203 |
| rustc | 77,962 -> 48,380 | 19,603 -> 19,213 | 25,384 | 4,588 |
| tokio | 13,967 -> 7,177 | 905 -> 905 | 3,210 | 3,580 |
| sqlx | 8,327 -> 4,097 | 516 -> 475 | 2,697 | 1,574 |
| TypeScript | 31,827 -> 26,588 | 2,077 -> 1,969 | 4,723 | 624 |
| django | 30,428 -> 8,368 | 62,679 -> 57,195 | 17,740 | 9,804 |
| pandas | 60,553 -> 19,336 | 38,835 -> 3,557 | 30,982 | 45,513 |
| celery | 11,046 -> 1,906 | 4,502 -> 2,280 | 4,626 | 6,736 |
| express | 5,442 -> 4,576 | 527 -> 49 | 725 | 619 |

Shares that hold: pandas's pytest and numpy receivers (60% of `method_not_on_type` in TASK-376.18) leave it, 91% moved to `import_unresolved`; rustc's prelude (27.7% of `name_not_in_scope`) is covered, `callee_is_a_language_global` equals 32.6% of the control's `name_not_in_scope`; django's builtins and stdlib (28%) are covered, `name_not_in_scope` falls 72%; sqlx's and tokio's prelude shares (26%, 28%) are covered: `callee_is_a_language_global` is 32% and 23% of their control `name_not_in_scope`, with a further 19% and 26% now `import_unresolved` for unindexed `std` paths.

**Shares that do not hold, and why.** Angular's 65.7% Jasmine share of `name_not_in_scope` is untouched: `expect`, `it`, `toBe` are bound by no declaration or import in the file set and are not a language's own words, so under this task's design (`callee_is_a_language_global` is the language's set, not a test framework's) they remain `name_not_in_scope`. Only 19% of angular's control `name_not_in_scope` moved. Django's 38% `unittest` share of `method_not_on_type` is untouched for a different reason: the receiver is `self`, typed as the test class, and the member is missing because the class's base is an import of an unindexed module, which is neither shape of AC #1 (receiver bound by an import) nor AC #2. Meeting those two shares needs either a test-framework global set (which breaks the contract that a reason is an observation, not a classification) or a base-class-through-unresolved-import route into `import_unresolved`; neither is in the Work plan.


## Evidence

The probe behind the root-cause table, reproduced with `packages/core/scripts/sample_failure_sites.ts` over a temporary corpus:

```python
# m.py, beside an importable mypkg.py
import os
import numpy as np
from collections import OrderedDict
from mypkg import helper

def f(p):
    os.getcwd()          # method_lookup/method_not_on_type
    os.path.dirname(p)   # receiver_resolution/method_not_on_type
    np.arange(3)         # method_lookup/method_not_on_type
    OrderedDict()        # name_resolution/name_not_in_scope
    helper(p)            # resolves — the in-corpus control
    len(p)               # name_resolution/name_not_in_scope
    print(p)             # name_resolution/name_not_in_scope
```

```typescript
// m.ts, beside an importable ./local.ts
import * as fs from "fs";
import { render } from "some-missing-pkg";
import { local } from "./local";

export function f(p: string): void {
  fs.readFileSync(p);   // method_lookup/method_not_on_type, import_target_file "fs"
  render(p);            // name_resolution/name_not_in_scope
  local(p);             // resolves — the in-corpus control
  console.log(p);       // name_resolution/name_not_in_scope
  JSON.stringify(p);    // name_resolution/name_not_in_scope
}
```

Both receivers are indexed as `variable:` definitions — `variable:…m.py:1:8:1:9:os` and `variable:…m.ts:1:13:1:14:fs` — which is the single fact that makes `method_lookup.ts:65` unreachable in both languages.

The corpus-scale shares are in TASK-376.18's `Residue, re-attributed` section and in `~/.ariadne/benchmark-runs/task-376.18/residue/`.
