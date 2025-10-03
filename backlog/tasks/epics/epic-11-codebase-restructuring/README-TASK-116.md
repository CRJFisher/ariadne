# Task 116: Integration Testing Overhaul

## Overview

Complete overhaul of integration testing using JSON fixtures to create a verifiable three-stage pipeline across all supported languages.

## Quick Navigation

### Main Documents
- **[SUMMARY](./task-epic-11.116-SUMMARY.md)** - Overview, effort estimates, strategy
- **[Main Task](./task-epic-11.116-Integration-Testing-Overhaul-with-JSON-Fixtures.md)** - Problem statement and solution

### Sub-Tasks

#### Phase 1: Foundation
- **[116.1 - Design](./task-epic-11.116.1-Design-Fixture-Folder-Structure-and-JSON-Schemas.md)** (~5-6h)
  - Design folder structure
  - Create JSON schemas
  - Define TypeScript types

- **[116.2 - Tooling](./task-epic-11.116.2-Implement-Fixture-Generation-Tooling.md)** (~10h)
  - Implement fixture generators
  - Create CLI tool
  - Add validation utilities

#### Phase 2: Fixtures
- **[116.3 - Code Fixtures](./task-epic-11.116.3-Create-Comprehensive-Code-Fixtures.md)** (~9h)
  - Audit and reorganize existing fixtures
  - Create feature coverage matrix
  - Fill coverage gaps

- **[116.4 - Generate JSON](./task-epic-11.116.4-Generate-Initial-JSON-Fixtures.md)** (~5-6h)
  - Generate semantic_index JSON
  - Generate resolved_symbols JSON
  - Generate call_graph JSON
  - Validate and commit baseline

#### Phase 3: Test Migration
- **[116.5 - semantic_index Tests](./task-epic-11.116.5-Update-Semantic-Index-Integration-Tests.md)** (~10h)
  - Refactor TypeScript, Python, Rust, JavaScript tests
  - Implement test helpers
  - Replace inline code with fixtures

- **[116.6 - symbol_resolution Tests](./task-epic-11.116.6-Update-Symbol-Resolution-Integration-Tests.md)** (~13h)
  - Refactor all language tests
  - Use semantic_index JSON as input
  - Validate against resolved_symbols JSON

- **[116.7 - call_graph Tests](./task-epic-11.116.7-Create-Call-Graph-Integration-Tests.md)** (~12h)
  - CREATE NEW integration tests
  - Use resolved_symbols JSON as input
  - Validate call graph detection

#### Phase 4: Documentation
- **[116.8 - Documentation](./task-epic-11.116.8-Documentation-and-Tooling-Finalization.md)** (~9h)
  - Document fixture formats
  - Create workflow guides
  - Add CI validation
  - Create troubleshooting guide

## Testing Pipeline

```
Code Fixtures (.ts, .py, .rs, .js)
    ↓ semantic_index.{lang}.test.ts
Semantic Index JSON
    ↓ symbol_resolution.{lang}.test.ts
Resolved Symbols JSON
    ↓ detect_call_graph.{lang}.test.ts  [NEW]
Call Graph JSON
```

## Key Benefits

1. **Single source of truth** - One code fixture tests all three stages
2. **Automatic coverage** - Symbol resolution tests cover all semantic_index features
3. **Easy maintenance** - Add fixture, regenerate JSON, tests update automatically
4. **Comprehensive** - Fills major gap (call_graph integration tests)
5. **Verifiable** - Each stage validates previous stage's output

## Getting Started

1. Read [SUMMARY](./task-epic-11.116-SUMMARY.md) for overview
2. Review [Main Task](./task-epic-11.116-Integration-Testing-Overhaul-with-JSON-Fixtures.md) for motivation
3. Start with [116.1 - Design](./task-epic-11.116.1-Design-Fixture-Folder-Structure-and-JSON-Schemas.md)

## Effort Summary

| Task | Effort | Type |
|------|--------|------|
| 116.1 | 5-6h | Design |
| 116.2 | 10h | Implementation |
| 116.3 | 9h | Organization |
| 116.4 | 5-6h | Generation |
| 116.5 | 10h | Refactoring |
| 116.6 | 13h | Refactoring |
| 116.7 | 12h | New Tests |
| 116.8 | 9h | Documentation |
| **Total** | **63-73h** | |

## Status

- [x] Planning complete
- [ ] Implementation not started
- [ ] All sub-tasks in "Not Started" status
