# Task epic-11.116: Integration Testing Overhaul with JSON Fixtures

**Status:** Not Started
**Epic:** Epic 11 - Codebase Restructuring
**Priority:** High
**Created:** 2025-10-03

## Overview

Overhaul integration testing strategy to use JSON fixture files as the "golden outputs" at each major marshalling point in the codebase. This creates a verifiable pipeline: **Code → Semantic Index → Symbol Resolution → Call Graph**, where each stage uses the previous stage's JSON output as input, reducing cognitive load and ensuring comprehensive test coverage.

## Problem Statement

Current integration tests suffer from several issues:

1. **Duplication of effort**: Each test suite (`semantic_index`, `symbol_resolution`) creates its own test data structures inline
2. **Coverage gaps**: Hard to ensure that symbol_resolution tests cover all language features tested in semantic_index
3. **Maintenance burden**: When language features change, multiple test files need updates
4. **No call graph integration tests**: The final stage (`detect_call_graph`) lacks comprehensive language-specific integration tests
5. **Hard to navigate**: Fixtures don't mirror code structure, making it difficult to find relevant test cases

## Proposed Solution

### Testing Pipeline

Create a verifiable chain where each stage validates against JSON fixtures:

```
1. Code Fixtures (*.ts, *.py, *.rs, etc.)
   ↓ [semantic_index]
2. SemanticIndex JSON Fixtures (*.semantic_index.json)
   ↓ [symbol_resolution]
3. ResolvedSymbols JSON Fixtures (*.resolved_symbols.json)
   ↓ [detect_call_graph]
4. CallGraph JSON Fixtures (*.call_graph.json)
```

### New Folder Structure

```
packages/core/tests/fixtures/
├── typescript/
│   ├── code/                          # Source code fixtures
│   │   ├── classes/
│   │   │   ├── basic_class.ts
│   │   │   ├── inheritance.ts
│   │   │   └── ...
│   │   ├── functions/
│   │   ├── interfaces/
│   │   ├── generics/
│   │   └── ...
│   ├── semantic_index/                # JSON outputs from semantic_index
│   │   ├── classes/
│   │   │   ├── basic_class.semantic_index.json
│   │   │   ├── inheritance.semantic_index.json
│   │   │   └── ...
│   │   └── ...
│   ├── resolved_symbols/              # JSON outputs from symbol_resolution
│   │   ├── classes/
│   │   │   ├── basic_class.resolved_symbols.json
│   │   │   └── ...
│   │   └── ...
│   └── call_graph/                    # JSON outputs from detect_call_graph
│       ├── classes/
│       │   ├── basic_class.call_graph.json
│       │   └── ...
│       └── ...
├── python/
│   ├── code/
│   ├── semantic_index/
│   ├── resolved_symbols/
│   └── call_graph/
├── rust/
│   └── ... (same structure)
└── javascript/
    └── ... (same structure)
```

### Benefits

1. **Single source of truth**: One code fixture generates JSON for all three stages
2. **Easy navigation**: Folder structure mirrors code organization
3. **Comprehensive coverage**: Symbol resolution tests automatically cover all semantic_index features
4. **Verifiable pipeline**: Each stage's output becomes next stage's input
5. **Easy fixture regeneration**: Tooling can regenerate all JSON fixtures when implementation changes
6. **Human-readable diffs**: JSON fixtures can be code-reviewed and diffed

## Success Criteria

- [ ] All existing semantic_index tests pass using new JSON fixture approach
- [ ] All existing symbol_resolution tests pass using new JSON fixture approach
- [ ] New call_graph integration tests created for all 4 languages
- [ ] Fixture regeneration tooling works for all three stages
- [ ] Documentation explains fixture format and update workflow
- [ ] CI validates that fixtures are up-to-date

## Implementation Strategy

See sub-tasks for detailed breakdown:
- **116.1**: Design fixture folder structure and JSON schemas
- **116.2**: Implement fixture generation tooling
- **116.3**: Create comprehensive code fixtures
- **116.4**: Generate initial JSON fixtures
- **116.5**: Update semantic_index integration tests
- **116.6**: Update symbol_resolution integration tests
- **116.7**: Create call_graph integration tests
- **116.8**: Documentation and tooling finalization

## Dependencies

- None (self-contained testing infrastructure improvement)

## Estimated Effort

- **Design & Planning**: 2-3 hours
- **Tooling Development**: 4-6 hours
- **Fixture Creation**: 3-4 hours
- **Test Refactoring**: 6-8 hours
- **Documentation**: 2-3 hours
- **Total**: ~17-24 hours

## Notes

- This is purely a testing infrastructure improvement - no production code changes
- Can be done incrementally (one language at a time, one stage at a time)
- Once complete, will significantly reduce maintenance burden for integration tests
- Sets foundation for future language additions

## Related Tasks

- Related to all Epic 11 tasks as it improves testing infrastructure