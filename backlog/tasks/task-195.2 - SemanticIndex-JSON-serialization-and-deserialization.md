---
id: TASK-195.2
title: SemanticIndex JSON serialization and deserialization
status: To Do
assignee: []
created_date: "2026-03-26 11:02"
labels: []
dependencies:
  - TASK-195.1
parent_task_id: TASK-195
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Create `serialize_semantic_index()` and `deserialize_semantic_index()` functions that convert a `SemanticIndex` to/from a JSON string. Extends the existing pattern in `tests/fixtures/index_single_file_json.ts` but as production code in the persistence module.

SemanticIndex contains 8 `ReadonlyMap` fields (definitions by kind), a `readonly SymbolReference[]` array, a `ReadonlyMap<ScopeId, LexicalScope>` for scopes, plus scalar fields. All values are plain data interfaces — no tree-sitter objects, no functions, no circular references.

Location: `packages/core/src/persistence/semantic_index_serialization.ts` with co-located tests.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Round-trip test: build_index_single_file() output survives serialize/deserialize with all Maps and arrays intact
- [ ] #2 Tests cover TypeScript, Python, JavaScript, and Rust files
- [ ] #3 All definition types (FunctionDefinition, ClassDefinition, VariableDefinition, InterfaceDefinition, EnumDefinition, NamespaceDefinition, TypeAliasDefinition, ImportDefinition) serialized correctly
- [ ] #4 All reference types (8 SymbolReference variants) serialized correctly
- [ ] #5 LexicalScope maps with parent/child relationships preserved
- [ ] #6 Co-located tests in semantic_index_serialization.test.ts
<!-- AC:END -->
