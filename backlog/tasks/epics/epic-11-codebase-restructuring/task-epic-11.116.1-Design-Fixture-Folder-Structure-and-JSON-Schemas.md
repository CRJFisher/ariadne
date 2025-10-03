# Task epic-11.116.1: Design Fixture Folder Structure and JSON Schemas

**Status:** Not Started
**Parent:** task-epic-11.116
**Priority:** High (blocking all other 116.x tasks)
**Created:** 2025-10-03

## Overview

Design the complete folder structure for the new fixture system and create JSON schemas for all three fixture types (SemanticIndex, ResolvedSymbols, CallGraph). This is the foundation for the entire testing overhaul.

## Objectives

1. Finalize folder structure that mirrors code organization
2. Design JSON schema for SemanticIndex fixtures
3. Design JSON schema for ResolvedSymbols fixtures
4. Design JSON schema for CallGraph fixtures
5. Create TypeScript types for fixture validation
6. Document schema design decisions

## Detailed Design Work

### 116.1.1: Design New Folder Structure

Create a structure that:
- Mirrors code organization (classes/, functions/, etc.)
- Supports all 4 languages (typescript, python, rust, javascript)
- Clearly separates code fixtures from JSON outputs
- Makes it easy to find related fixtures across stages

**Proposed structure** (see parent task for full example):
```
fixtures/
  {language}/
    code/{feature_category}/{test_case}.{ext}
    semantic_index/{feature_category}/{test_case}.semantic_index.json
    resolved_symbols/{feature_category}/{test_case}.resolved_symbols.json
    call_graph/{feature_category}/{test_case}.call_graph.json
```

**Deliverables:**
- [ ] Document final folder structure with examples
- [ ] List feature categories for each language
- [ ] Define naming conventions for fixtures

### 116.1.2: Design SemanticIndex JSON Schema

Create a JSON representation of `SemanticIndex` that is:
- **Human-readable**: Easy to review in code reviews
- **Diffable**: Changes show up clearly in git diffs
- **Complete**: Captures all information from SemanticIndex type
- **Stable**: Schema won't change frequently

**Key considerations:**
- How to serialize Maps (convert to objects or arrays?)
- How to represent SymbolId/ScopeId/LocationKey (keep as strings)
- How to handle Location objects (line/column info)
- How to format for readability (indentation, ordering)

**Example structure:**
```json
{
  "file_path": "test.ts",
  "language": "typescript",
  "root_scope_id": "scope:test.ts:module",
  "scopes": {
    "scope:test.ts:module": {
      "id": "scope:test.ts:module",
      "parent": null,
      "children": ["scope:test.ts:function:foo"],
      "symbols": ["symbol:test.ts:function:foo:1:0"]
    }
  },
  "functions": {
    "symbol:test.ts:function:foo:1:0": {
      "id": "symbol:test.ts:function:foo:1:0",
      "name": "foo",
      "location": {"row": 1, "column": 0},
      "scope_id": "scope:test.ts:module"
    }
  },
  "classes": {},
  "variables": {},
  "interfaces": {},
  "references": [
    {
      "name": "console",
      "location": {"row": 2, "column": 2},
      "reference_type": "variable_reference",
      "scope_id": "scope:test.ts:function:foo"
    }
  ]
  // ... other collections
}
```

**Deliverables:**
- [ ] JSON schema document
- [ ] Example fixtures for 2-3 test cases
- [ ] Decision log for serialization choices

### 116.1.3: Design ResolvedSymbols JSON Schema

Create a JSON representation of `ResolvedSymbols` output:

**Key fields to capture:**
- `definitions`: Map of SymbolId → Definition
- `references`: Array of SymbolReference
- `resolved_references`: Map of LocationKey → SymbolId
- `references_to_symbol`: Map of SymbolId → LocationKey[]
- `type_context`: Type information (if any)

**Example structure:**
```json
{
  "file_path": "test.ts",
  "definitions": {
    "symbol:test.ts:function:foo:1:0": {
      "id": "symbol:test.ts:function:foo:1:0",
      "name": "foo",
      "definition_type": "function",
      "location": {"row": 1, "column": 0}
    }
  },
  "references": [
    {
      "name": "foo",
      "location": {"row": 5, "column": 0},
      "reference_type": "function_call",
      "scope_id": "scope:test.ts:module"
    }
  ],
  "resolved_references": {
    "test.ts:5:0": "symbol:test.ts:function:foo:1:0"
  },
  "references_to_symbol": {
    "symbol:test.ts:function:foo:1:0": ["test.ts:5:0"]
  }
}
```

**Deliverables:**
- [ ] JSON schema document
- [ ] Example fixtures for 2-3 test cases
- [ ] Mapping of ResolvedSymbols type fields to JSON

### 116.1.4: Design CallGraph JSON Schema

Create a JSON representation of `CallGraph` output:

**Key fields to capture:**
- `nodes`: Map of SymbolId → FunctionNode
- `entry_points`: Array of SymbolId
- Each FunctionNode contains enclosed_calls

**Example structure:**
```json
{
  "nodes": {
    "symbol:test.ts:function:main:1:0": {
      "symbol_id": "symbol:test.ts:function:main:1:0",
      "name": "main",
      "location": {"row": 1, "column": 0},
      "enclosed_calls": [
        {
          "name": "helper",
          "location": {"row": 2, "column": 2},
          "reference_type": "function_call",
          "resolved_to": "symbol:test.ts:function:helper:5:0"
        }
      ]
    },
    "symbol:test.ts:function:helper:5:0": {
      "symbol_id": "symbol:test.ts:function:helper:5:0",
      "name": "helper",
      "location": {"row": 5, "column": 0},
      "enclosed_calls": []
    }
  },
  "entry_points": [
    "symbol:test.ts:function:main:1:0"
  ]
}
```

**Deliverables:**
- [ ] JSON schema document
- [ ] Example fixtures for 2-3 test cases
- [ ] Document entry point detection logic

### 116.1.5: Create TypeScript Types for Fixture Schemas

Create TypeScript type definitions for all fixture schemas:
- Enables type-safe fixture loading/validation
- Can use for fixture generation utilities
- Self-documenting via TypeScript types

**Location**: `packages/core/tests/fixtures/types.ts` or similar

**Deliverables:**
- [ ] TypeScript types for all three fixture schemas
- [ ] Utility functions for loading/parsing fixtures
- [ ] Validation functions (optional: use zod or similar)

## Acceptance Criteria

- [ ] All five sub-tasks (116.1.1 - 116.1.5) completed
- [ ] JSON schemas are well-documented with examples
- [ ] Folder structure is clearly defined
- [ ] TypeScript types match JSON schemas exactly
- [ ] Design decisions documented for future reference
- [ ] Team review of schemas completed

## Estimated Effort

- **Folder Structure Design**: 30 minutes
- **SemanticIndex Schema**: 1.5 hours
- **ResolvedSymbols Schema**: 1 hour
- **CallGraph Schema**: 45 minutes
- **TypeScript Types**: 1 hour
- **Documentation**: 30 minutes
- **Total**: ~5-6 hours

## Notes

- Consider using existing JSON schema validation libraries
- Keep schemas simple initially - can enhance later
- Prioritize human-readability over compactness
- Schema should be stable - changes require fixture regeneration

## Output

Place all design documents in:
`backlog/tasks/epics/epic-11-codebase-restructuring/task-116.1-design-docs/`

Including:
- `folder-structure.md`
- `semantic-index-schema.md`
- `resolved-symbols-schema.md`
- `call-graph-schema.md`
- `decisions.md` (design decision log)
