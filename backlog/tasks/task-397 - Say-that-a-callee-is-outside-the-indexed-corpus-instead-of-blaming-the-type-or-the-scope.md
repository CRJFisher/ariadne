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

- [ ] #1 A call whose receiver is bound by an import that resolved to no indexed file fails `import_unresolved`, in every one of the four languages, and no longer fails `method_not_on_type`.
- [ ] #2 A call whose name is bound by an import that resolved to no indexed file fails `import_unresolved` and no longer fails `name_not_in_scope`.
- [ ] #3 `partial_info.import_target_file` names only a file the corpus indexed; an unresolved module is carried as its specifier instead.
- [ ] #4 `callee_is_a_language_global` exists in `ResolutionFailureReason`, `RESOLUTION_FAILURE_REASONS` and `REASON_TO_AREA`, and `len`, `print`, `console`, `JSON`, `Ok`, `Some` and `require` fail under it rather than under `name_not_in_scope`.
- [ ] #5 Both reasons route to a fault area with no owning module, so the plan engine stops routing them to `name_resolution` and `import_resolution`.
- [ ] #6 Integration tests at the `Project` tier cover, per language, an out-of-corpus namespace import, an out-of-corpus named import, a language global, and an in-corpus control that still resolves.
- [ ] #7 The nine evidence corpora are re-run: resolved calls, the call-edge fingerprint and the raw-entry-point fingerprint are **unchanged** against `RECORDED_CORPUS_RESOLUTION`, and the two reasons account for the shares TASK-376.18 measured (angular ~65.7% of `name_not_in_scope`, pandas ~60% of `method_not_on_type`, django ~38% and ~28%).

<!-- AC:END -->

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
