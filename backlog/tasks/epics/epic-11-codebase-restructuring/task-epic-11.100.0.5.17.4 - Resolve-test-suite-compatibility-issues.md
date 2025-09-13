---
id: task-epic-11.100.0.5.17.4
title: Resolve test suite compatibility issues with type harmonization
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['testing', 'compatibility', 'type-harmonization']
dependencies: ['task-epic-11.100.0.5.17.1', 'task-epic-11.100.0.5.17.2', 'task-epic-11.100.0.5.17.3']
parent_task_id: task-epic-11.100.0.5.17
priority: medium
---

## Description

Resolve the widespread test suite compatibility issues discovered after type harmonization changes, where 82 out of 169 test files are failing.

## Background

The removal of adapters and migration to unified types has revealed widespread test compatibility issues across the codebase. Many tests may be expecting the old type structures or adapter behavior that no longer exists.

## Acceptance Criteria

- [ ] Reduce failing test files from 82 to under 10
- [ ] All core file analysis functionality tests pass
- [ ] Import/export analysis tests work with unified types
- [ ] Type tracking tests are compatible with new unified system
- [ ] Call graph analysis tests pass
- [ ] Scope analysis tests work correctly

## Implementation Strategy

**Phase 1: Categorize Failures**
- Analyze test failures by module (file_analyzer, import_export, type_analysis, etc.)
- Identify common patterns in failures
- Separate type structure issues from logic bugs

**Phase 2: Fix Type Structure Issues**
- Update test expectations to match unified type structures
- Fix any test utilities that depend on old adapter types
- Update mock data to use unified types

**Phase 3: Fix Logic Issues**
- Address any actual bugs revealed by removing adapters
- Fix integration issues between modules
- Ensure backward compatibility where needed

## Investigation Areas

**Test Categories to Review:**
- `file_analyzer.*test.ts` - Core analysis functionality
- `import_export/*test.ts` - Import/export analysis
- `type_analysis/*test.ts` - Type tracking and inference
- `call_graph/*test.ts` - Function and method call analysis
- `scope_analysis/*test.ts` - Scope tree and symbol resolution

**Common Failure Patterns:**
- Type assertion failures (expecting old types)
- Undefined property access (missing adapter conversions)
- Structure mismatches (unified vs. internal types)

## Affected Files

- All test files in packages/core/src/**/*.test.ts
- Test utilities and fixtures
- Mock data structures

## Success Metrics

- Test suite passes with >95% success rate
- No more than 5-10 test files failing
- All critical functionality tests pass
- Performance tests show improvement from adapter removal