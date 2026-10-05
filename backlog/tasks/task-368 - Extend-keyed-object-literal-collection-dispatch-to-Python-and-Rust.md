---
id: TASK-368
title: Extend keyed object-literal collection dispatch to Python and Rust
status: To Do
assignee: []
created_date: '2026-07-21 11:20'
labels:
  - call-resolution
  - python
  - follow-up
dependencies:
  - TASK-356
references:
  - >-
    packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.python.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-356's key-aware object-literal dispatch (`keyed_members` on FunctionCollection, `collection_source_key` on VariableDefinition) is JavaScript/TypeScript only — its producers live in `symbol_factories.javascript.ts` and the fields are tagged `@language javascript,typescript`. Python (`symbol_factories.python.ts`) and Rust (`symbol_factories.rust.ts`) `detect_function_collection` variants never populate `keyed_members`, so a Python dict of functions (`ns = { 'a': fn }; alias = ns['a']`... or attribute-style) or a Rust equivalent does not get keyed member dispatch — they fall through to the existing flat-list union. Python dicts carry real string keys, so keyed dispatch is directly applicable there. Evaluate demand (triage evidence) before implementing; Rust object-literal collections may be rare enough to defer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Python object/dict function collections populate keyed_members with their string keys
- [ ] #2 Keyed member dispatch and single-hop alias resolution work for Python collections
- [ ] #3 Rust applicability assessed; implemented or explicitly deferred with rationale
- [ ] #4 Regression tests cover the Python keyed dispatch and alias cases
<!-- AC:END -->
